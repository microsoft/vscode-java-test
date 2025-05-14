/**
 * HackerRank-Specific Logic
 * Dynamically waits for a list of extension dependencies to become available and active,
 * replacing static extensionDependencies in package.json.
 * - Waits up to 2 minutes total (not per extension),
 * - Checks availability and attempts activation in parallel,
 * - Fails only if any required extension fails to activate within the total timeout.
 */

import { extensions, Extension, OutputChannel, window } from 'vscode';

// Create an OutputChannel for logging
const logger: OutputChannel = window.createOutputChannel('Java Test Runner');

const WAIT_TIME_MS: number = 3000; // 3 seconds
const MAX_ATTEMPTS: number = 40; // 40 attempts * 3 seconds = 120 seconds (2 minutes)


/**
 * Waits for a single extension to activate within a timeout window.
 */
async function waitForExtension(depId: string): Promise<boolean> {
    for (let attempt: number = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const ext: Extension<any> | undefined = extensions.getExtension(depId);
        const timeElapsedSec: number = ((attempt + 1) * WAIT_TIME_MS) / 1000;
        if (ext) {
            try {
                if (!ext.isActive) {
                    logger.appendLine(
                        `[waitDeps] [${depId}][${timeElapsedSec}s] Found but not active. Activating...`
                    );
                    await ext.activate();
                }

                if (ext.isActive) {
                    logger.appendLine(`[waitDeps] [${depId}] Activated successfully.`);
                    return true;
                }
            } catch (e) {
                logger.appendLine(
                    `[waitDeps] [${depId}][${timeElapsedSec}s] Activation failed: ${e}`
                );
            }
        } else {
            logger.appendLine(
                `[waitDeps] [${depId}][${timeElapsedSec}s] Not found. Retrying...`
            );
        }
        await new Promise<void>((resolve: (value: void) => void) =>
            setTimeout(resolve, WAIT_TIME_MS)
        );
    }
    logger.appendLine(`[waitDeps] [${depId}] Failed to activate within 2 minutes.`);
    return false;
}

/**
 * Waits for all required extensions in parallel.
 * Returns true if all are activated, otherwise false.
 */
export async function waitForExtensionDependencies(): Promise<boolean> {
    logger.appendLine('[waitDeps] Checking for required extension dependencies...');
    const extensionDependencies: string[] = [
        'redhat.java',
        'vscjava.vscode-java-debug'
    ];
    const results: Record<string, boolean> = {};
    await Promise.all(
        extensionDependencies.map(async (depId: string) => {
            logger.appendLine(`[waitDeps] Waiting for ${depId}...`);
            results[depId] = await waitForExtension(depId);
        })
    );
    const failed: string[] = Object.entries(results)
        .filter(([, success]: [string, boolean]) => !success)
        .map(([depId]: [string, boolean]) => depId);
    const failedDepsString: string = `[${failed.join(', ')}]`;
    if (failed.length > 0) {
        logger.appendLine(`[waitDeps] Failed dependencies: ${failedDepsString}`);
        window.showErrorMessage(
            `Activation failed: Java Test Runner requires the ${failedDepsString} extension(s), but they did not activate in time.`
        );
        return false;
    }
    logger.appendLine('[waitDeps] All dependencies activated successfully.');
    return true;
}