package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import org.gradle.tooling.CancellationTokenSource
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.test.*

fun testListener(
    tasks: Map<String, GradleTask>,
    taskStartTimes: MutableMap<String, Long>,
    taskResults: MutableMap<String, TaskResult>,
    testTaskStatus: MutableMap<String, Boolean>,
    testStartTimes: MutableMap<String, Long>,
    testEndTimes: MutableMap<String, Long>,
    expectedTestTasks: List<String>,
    cancellationTokenSource: CancellationTokenSource
): (ProgressEvent) -> Unit {
  val completedTasks = mutableSetOf<String>()
  return { event ->
    when (event) {
      is TaskStartEvent,
      is TaskFinishEvent -> buildListener(tasks, taskStartTimes, taskResults)(event)

      is TestStartEvent -> {
        logger.info("TestStartEvent $event")
        ((event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
          tasks.entries
              .find { entry ->
                entry.value.testClassName?.let { className.endsWith(".${it}") || it == className }
                    ?: false
              }
              ?.key
              ?.let { nxTaskId ->
                testStartTimes.computeIfAbsent(nxTaskId) { event.eventTime }
                logger.info("🏁 Test start at ${event.eventTime}: $nxTaskId $className")
              }
        })
      }

      is TestFinishEvent -> {
        if ((event.descriptor as? JvmTestOperationDescriptor)?.className == null &&
            event.descriptor.name.startsWith("Gradle Test Run ")) {
          val taskPath = event.descriptor.name.removePrefix("Gradle Test Run ").trim()

          if (taskPath in expectedTestTasks && completedTasks.add(taskPath)) {
            logger.info("✅ Task succeeded: $taskPath")
            if (completedTasks.containsAll(expectedTestTasks) &&
                !cancellationTokenSource.token().isCancellationRequested) {
              logger.info("✅ All expected test tasks succeeded, cancelling execution.")
              cancellationTokenSource.cancel()
            }
          }
        }

        ((event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
          tasks.entries
              .find { entry ->
                entry.value.testClassName?.let { className.endsWith(".${it}") || it == className }
                    ?: false
              }
              ?.key
              ?.let { nxTaskId ->
                testEndTimes.compute(nxTaskId) { _, _ -> event.result.endTime }
                when (event.result) {
                  is TestSuccessResult ->
                      logger.info(
                          "\u2705 Test passed at ${event.result.endTime}: $nxTaskId $className")

                  is TestFailureResult -> {
                    testTaskStatus[nxTaskId] = false
                    logger.warning("\u274C Test failed: $nxTaskId $className")
                  }

                  is TestSkippedResult ->
                      logger.warning("\u26A0\uFE0F Test skipped: $nxTaskId $className")

                  else -> logger.warning("\u26A0\uFE0F Unknown test result: $nxTaskId $className")
                }
              }
        })
      }
    }
  }
}
