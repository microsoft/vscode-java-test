// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT license.

// import { Disposable } from 'vscode';
// import { executeJavaLanguageServerCommand, JAVA_SEARCH_TEST_ENTRY } from './Constants/commands';
// import { TestEntry, TestEntryType, TestSuite } from './Models/protocols';

// class TestCacheController implements Disposable {
//     private testCache = new TestCache();

//     public async searchTestChildren(
//    parentUri: string, parentType: TestEntryType, parentFullName: string, fetchAll: boolean): Promise<TestEntry[]> {
//         const children: TestEntry[] = await this.searchTestEntries(parentUri, parentType, parentFullName, fetchAll);
//         this.testCache.updateTests(...children);
//         return children;
//     }

//     public removeTests(uri: string): void {
//         this.testCache.removeTests(uri);
//     }

//     public dispose() {
//         this.testCache.dispose();
//     }

//     private async searchTestEntries(uri: string, type: TestEntryType, fullName: string, fetchAll: boolean): Promise<TestEntry[]> {
//         const parent: TestEntry | undefined = this.testCache.getTestEntry(uri);
//         if (!parent) {
//             throw new Error(`Failed to find testEntry with uri: ${uri}`);
//         }
//         const children: TestEntry[] = await executeJavaLanguageServerCommand<TestEntry[]>(
//             JAVA_SEARCH_TEST_ENTRY, JSON.stringify({uri, type, fullName, fetchAll}));
//         this.addParentReference(parent, ...children);
//         return children;
//     }

//     /**
//      * The element returned from LS will only contain reference of children (no parent) to avoid cyclic reference
//      * We need to complete the parent reference at client side.
//      */
//     private addParentReference(parent: TestEntry, ...tests: TestEntry[]): void {
//         for (const test of tests) {
//             test.parent = parent;
//             if (test.children) {
//                 this.addParentReference(test, ...test.children);
//             }
//         }
//     }
// }

// class TestCache implements Disposable {
//     private testsCacheMap = new Map<string, TestEntry>();

//     public getTestEntry(key: string): TestEntry | undefined {
//         return this.testsCacheMap.get(key);
//     }

//     public storeTests(...tests: TestEntry[]): void {
//         for (const test of tests) {
//             if (test.parent && test.parent.uri === test.uri) {
//                 continue;
//             }
//             this.testsCacheMap.set(test.uri, test);
//         }
//     }

//     public updateTests(...tests: TestEntry[]): void {
//         for (const test of tests) {
//             this.removeTests(test.uri);
//         }
//         this.storeTests(...tests);
//     }

//     public removeTests(key: string): void {
//         const testEntry: TestEntry | undefined = this.getTests(key);
//         if (testEntry) {
//             if (testEntry.children) {
//                 for (const child of testEntry.children) {
//                     child.parent = undefined;
//                     this.removeTests(child.uri);
//                 }
//             }
//             testEntry.children = undefined;
//             this.testsCacheMap.delete(key);
//         }
//     }

//     public dispose(): void {
//         this.testsCacheMap.clear();
//     }
// }
