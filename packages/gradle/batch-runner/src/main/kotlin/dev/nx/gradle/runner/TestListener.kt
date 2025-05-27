package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
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
  val runningTasks = mutableSetOf<String>()
  val completedTasks = mutableSetOf<String>()
  var lastTaskId: String? = null

  return { event ->
    logger.info("event $event")
    when (event) {
      is TaskStartEvent,
      is TaskFinishEvent -> buildListener(tasks, taskStartTimes, taskResults)(event)

      is TestStartEvent -> {
        runningTasks.add(event.descriptor.name)
        logger.info("TestStartEvent $event ${event.descriptor.name}")
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
        runningTasks.remove(event.descriptor.name)
        logger.info("runningTasks ${event.descriptor.name} ${event.toString()} $runningTasks")
        val className = (event.descriptor as? JvmTestOperationDescriptor)?.className
        if (className == null && event.descriptor.name.startsWith("Gradle Test Run ")) {
          val taskPath = event.descriptor.name.removePrefix("Gradle Test Run ").trim()
          if (taskPath in expectedTestTasks && completedTasks.add(taskPath)) {
            logger.info("✅ Task succeeded: $taskPath")
          }
        }
        if (completedTasks.containsAll(expectedTestTasks) && runningTasks.isEmpty()) {
          logger.info("✅ All expected test tasks succeeded, cancelling execution.")
          GlobalScope.launch {
            lastTaskId?.let { testEndTimes.compute(it) { _, _ -> event.eventTime } }
            if (!cancellationTokenSource.token().isCancellationRequested) {
              cancellationTokenSource.cancel()
            }
          }
        }

        className?.let {
          tasks.entries
              .find { entry ->
                entry.value.testClassName?.let { className.endsWith(".${it}") || it == className }
                    ?: false
              }
              ?.key
              ?.let { nxTaskId ->
                lastTaskId = nxTaskId
                testEndTimes.compute(nxTaskId) { _, _ -> event.result.endTime }
                when (event.result) {
                  is TestSuccessResult ->
                      logger.info("✅ Test passed at ${event.result.endTime}: $nxTaskId $className")

                  is TestFailureResult -> {
                    testTaskStatus[nxTaskId] = false
                    logger.warning("❌ Test failed: $nxTaskId $className")
                  }

                  is TestSkippedResult -> logger.warning("⚠️ Test skipped: $nxTaskId $className")
                  else -> logger.warning("⚠️ Unknown test result: $nxTaskId $className")
                }
              }
        }
      }
    }
  }
}
