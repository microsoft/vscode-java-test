/*******************************************************************************
* Copyright (c) 2021 Microsoft Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v1.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v10.html
*
* Contributors:
*     Microsoft Corporation - initial API and implementation
*******************************************************************************/

package com.microsoft.java.test.plugin.util;

import com.microsoft.java.test.plugin.model.Option;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.provider.TestKindProvider;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.IImportDeclaration;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IMethod;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaConventions;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.AbstractTypeDeclaration;
import org.eclipse.jdt.core.dom.Annotation;
import org.eclipse.jdt.core.dom.Block;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.IMethodBinding;
import org.eclipse.jdt.core.dom.IPackageBinding;
import org.eclipse.jdt.core.dom.ITypeBinding;
import org.eclipse.jdt.core.dom.MethodDeclaration;
import org.eclipse.jdt.core.dom.Modifier;
import org.eclipse.jdt.core.dom.NodeFinder;
import org.eclipse.jdt.core.dom.PrimitiveType;
import org.eclipse.jdt.core.dom.TypeDeclaration;
import org.eclipse.jdt.core.dom.rewrite.ASTRewrite;
import org.eclipse.jdt.core.dom.rewrite.ImportRewrite;
import org.eclipse.jdt.core.dom.rewrite.ImportRewrite.ImportRewriteContext;
import org.eclipse.jdt.core.dom.rewrite.ListRewrite;
import org.eclipse.jdt.core.formatter.CodeFormatter;
import org.eclipse.jdt.core.refactoring.CompilationUnitChange;
import org.eclipse.jdt.internal.core.manipulation.StubUtility;
import org.eclipse.jdt.internal.corext.codemanipulation.CodeGenerationSettings;
import org.eclipse.jdt.internal.corext.codemanipulation.ContextSensitiveImportRewriteContext;
import org.eclipse.jdt.internal.corext.codemanipulation.StubUtility2Core;
import org.eclipse.jdt.internal.corext.dom.ASTNodeFactory;
import org.eclipse.jdt.internal.corext.refactoring.changes.CreateCompilationUnitChange;
import org.eclipse.jdt.internal.corext.util.CodeFormatterUtil;
import org.eclipse.jdt.ls.core.internal.ChangeUtil;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.jdt.ls.core.internal.handlers.CodeGenerationUtils;
import org.eclipse.jdt.ls.core.internal.text.correction.SourceAssistProcessor;
import org.eclipse.lsp4j.MessageType;
import org.eclipse.lsp4j.WorkspaceEdit;
import org.eclipse.text.edits.InsertEdit;
import org.eclipse.text.edits.MalformedTreeException;
import org.eclipse.text.edits.MultiTextEdit;
import org.eclipse.text.edits.TextEdit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public class TestGenerationUtils {

    private static final String JUNIT4_PREFIX = "org.junit";
    private static final String JUNIT5_PREFIX = "org.junit.jupiter";
    private static final String TESTNG_PREFIX = "org.testng";

    private static final String JUNIT4_LIFECYCLE_ANNOTATION_PREFIX = "org.junit.";
    private static final String JUNIT4_BEFORE_CLASS_ANNOTATION = "BeforeClass";
    private static final String JUNIT4_SET_UP_ANNOTATION = "Before";
    private static final String JUNIT4_TEAR_DOWN_ANNOTATION = "After";
    private static final String JUNIT4_AFTER_CLASS_ANNOTATION = "AfterClass";

    private static final String JUNIT5_LIFECYCLE_ANNOTATION_PREFIX = "org.junit.jupiter.api.";
    private static final String JUNIT5_BEFORE_CLASS_ANNOTATION = "BeforeAll";
    private static final String JUNIT5_SET_UP_ANNOTATION = "BeforeEach";
    private static final String JUNIT5_TEAR_DOWN_ANNOTATION = "AfterEach";
    private static final String JUNIT5_AFTER_CLASS_ANNOTATION = "AfterAll";

    private static final String TESTNG_LIFECYCLE_ANNOTATION_PREFIX = "org.testng.annotations.";
    private static final String TESTNG_BEFORE_CLASS_ANNOTATION = "BeforeClass";
    private static final String TESTNG_SET_UP_ANNOTATION = "BeforeMethod";
    private static final String TESTNG_TEAR_DOWN_ANNOTATION = "AfterMethod";
    private static final String TESTNG_AFTER_CLASS_ANNOTATION = "AfterClass";

    public static WorkspaceEdit generateTests(List<Object> arguments, IProgressMonitor monitor)
            throws MalformedTreeException, CoreException {
        if (arguments == null || arguments.size() < 2) {
            throw new IllegalArgumentException("Wrong arguments passed to generate tests");
        }

        final String uri = (String) arguments.get(0);
        final ICompilationUnit unit = JDTUtils.resolveCompilationUnit(uri);
        if (unit == null) {
            JUnitPlugin.logError("Failed to parse compilation unit from " + uri);
            return null;
        }

        final CompilationUnit root = (CompilationUnit) TestSearchUtils.parseToAst(unit,
                true /* fromCache */, monitor);

        final int cursorOffset = ((Double) arguments.get(1)).intValue();
        final NodeFinder nodeFinder = new NodeFinder(root, cursorOffset, 0);
        ASTNode coveringNode = nodeFinder.getCoveringNode();

        while (coveringNode != null) {
            if (coveringNode instanceof AbstractTypeDeclaration) {
                break;
            }
            coveringNode = coveringNode.getParent();
        }
        if (coveringNode == null) {
            final IType primaryType = unit.findPrimaryType();
            if (primaryType == null) {
                return null;
            }
            coveringNode = root.findDeclaringNode(primaryType.getKey());
        }

        if (!(coveringNode instanceof AbstractTypeDeclaration)) {
            JUnitPlugin.logError("Failed to find type declaration from " + unit.getElementName());
            return null;
        }

        final ITypeBinding binding = ((AbstractTypeDeclaration) coveringNode).resolveBinding();
        if (binding == null) {
            JUnitPlugin.logError("Failed to resolve type binding from " + unit.getElementName());
            return null;
        }

        if (!(binding.isClass() || binding.isInterface() || binding.isRecord() || binding.isEnum())) {
            JavaLanguageServerPlugin.getInstance().getClientConnection().showNotificationMessage(MessageType.Error,
                    "Cannot generate tests if it's not a Java class/interface/record/enum.");
            return null;
        }

        final IJavaProject javaProject = unit.getJavaProject();
        if (javaProject == null) {
            JUnitPlugin.logError("Cannot get Java project from " + unit.getElementName());
            return null;
        }

        for (final IClasspathEntry entry : javaProject.readRawClasspath()) {
            if (entry.getPath().isPrefixOf(unit.getPath())) {
                if (ProjectTestUtils.isTestEntry(entry)) {
                    return generateTestsFromTest(unit, root, (TypeDeclaration) coveringNode, binding, cursorOffset);
                } else {
                    return generateTestsFromSource(unit, binding, cursorOffset);
                }
            }
        }

        return null;
    }

    /**
     * Generate test methods from a focal source file
     */
    private static WorkspaceEdit generateTestsFromSource(ICompilationUnit unit, ITypeBinding typeBinding,
            int cursorOffset) throws CoreException {
        final IJavaProject javaProject = determineTestProject(unit);
        if (javaProject == null) {
            return null;
        }
        final List<TestKind> testFrameworksInProject = TestKindProvider.getTestKindsFromCache(javaProject);
        final TestKind testKind = determineTestFramework(new HashSet<>(testFrameworksInProject));
        if (testKind == null) {
            return null;
        }

        final IClasspathEntry testEntry = getTestClasspathEntry(javaProject, unit);
        if (testEntry == null) {
            JavaLanguageServerPlugin.getInstance().getClientConnection().showNotificationMessage(MessageType.Error,
                    "Cannot find a valid classpath entry to generate tests.");
            return null;
        }
        final String testFullyQualifiedName = getTestFullyQualifiedName(typeBinding, javaProject, testEntry);
        if (testFullyQualifiedName == null) {
            return null;
        }
        final List<String> methodsToTest = getMethodsToTest(typeBinding);
        if (methodsToTest == null) {
            return null;
        }

        final ICompilationUnit testUnit = getTestCompilationUnit(javaProject, testEntry, testFullyQualifiedName);
        return scaffoldTestFile(testKind, testUnit, methodsToTest, cursorOffset);
    }

    private static WorkspaceEdit scaffoldTestFile(TestKind kind, ICompilationUnit testUnit,
            List<String> methodsToTest, int cursorPosition) throws CoreException {
        if (testUnit.exists()) {
            final IType[] types = testUnit.getAllTypes();
            if (types.length == 0) {
                // an empty java file
                return addTestClassToExistingFile(kind, testUnit, methodsToTest);
            }

            final CompilationUnit root = (CompilationUnit) TestSearchUtils.parseToAst(testUnit,
                false /* fromCache */, new NullProgressMonitor());

            if (root == null) {
                return null;
            }

            IType type = testUnit.findPrimaryType();
            if (type == null) {
                type = types[0];
            }

            final ASTNode typeNode = root.findDeclaringNode(type.getKey());
            if (!(typeNode instanceof TypeDeclaration)) {
                return null;
            }

            final ITypeBinding binding = ((TypeDeclaration) typeNode).resolveBinding();
            if (binding == null) {
                return null;
            }

            IJavaElement insertPosition = null; // Insert to the last by default.
            try {
                insertPosition = CodeGenerationUtils.findInsertElement(type, cursorPosition);
            } catch (Throwable e) {
                // ignore if the upstream does not support insert position preference.
            }

            return addTestMethodsToExistingTestClass(root, kind, methodsToTest, (TypeDeclaration) typeNode,
                    binding, insertPosition);
        } else {
            return createNewTestClass(kind, testUnit, methodsToTest);
        }
    }

    /**
     * Get a compilation unit change without creating.
     */
    private static WorkspaceEdit addTestClassToExistingFile(TestKind kind, ICompilationUnit testUnit,
            List<String> methodsToTest) throws CoreException {
        final CompilationUnitChange cuChange = new CompilationUnitChange("", testUnit);
        final String cuContent = constructNewCU(testUnit, methodsToTest, kind);
        cuChange.setEdit(new InsertEdit(0, cuContent));
        return ChangeUtil.convertToWorkspaceEdit(cuChange);
    }

    /**
     * Create and get a compilation unit change.
     */
    private static WorkspaceEdit createNewTestClass(TestKind kind, ICompilationUnit testUnit,
            List<String> methodsToTest) throws CoreException {
        final String cuContent = constructNewCU(testUnit, methodsToTest, kind);
        final CreateCompilationUnitChange change =
                new CreateCompilationUnitChange(testUnit, cuContent, "");
        return ChangeUtil.convertToWorkspaceEdit(change);
    }

    private static WorkspaceEdit addTestMethodsToExistingTestClass(CompilationUnit testRoot, TestKind kind,
            List<String> methodsToTest, TypeDeclaration typeNode, ITypeBinding typeBinding,
            IJavaElement insertPosition) throws JavaModelException, CoreException {
        final String testAnnotation = getTestAnnotation(kind);
        final List<MethodMetaData> metadata = methodsToTest.stream().map(method -> {
            final String methodName = getTestMethodName(method);
            return new MethodMetaData(methodName, testAnnotation);
        }).collect(Collectors.toList());

        final TextEdit edit = getTextEdit(kind, metadata, testRoot, typeNode, typeBinding, insertPosition,
                false /*fromTest*/);
        return SourceAssistProcessor.convertToWorkspaceEdit((ICompilationUnit) testRoot.getJavaElement(), edit);
    }

    private static String constructNewCU(ICompilationUnit testUnit,
            List<String> methods, TestKind testKind) throws CoreException {
        final String delimiter = StubUtility.getLineDelimiterUsed(testUnit);
        final String typeStub = constructTypeStub(testUnit, methods, testKind, delimiter);
        final String cuContent = constructCUContent(testUnit, methods.size() > 0, testKind, typeStub, delimiter);
        final String formattedCuStub = CodeFormatterUtil.format(
                CodeFormatter.K_COMPILATION_UNIT, cuContent, 0, delimiter, testUnit.getJavaProject().getOptions(true));
        return formattedCuStub;
    }

    private static String constructCUContent(ICompilationUnit testUnit, boolean hasMethods, TestKind testKind, 
            String typeContent, String lineDelimiter) throws CoreException {
        final IPackageFragment packageFragment = (IPackageFragment) testUnit.getParent();
        final StringBuilder buf = new StringBuilder();
        if (!packageFragment.isDefaultPackage()) {
            buf.append("package ")
                .append(packageFragment.getElementName())
                .append(";")
                .append(lineDelimiter)
                .append(lineDelimiter);
        }

        if (hasMethods) {
            buf.append("import ")
                .append(getTestAnnotation(testKind))
                .append(";")
                .append(lineDelimiter)
                .append(lineDelimiter);
        }

        buf.append(typeContent);

        return buf.toString();
    }

    private static String constructTypeStub(ICompilationUnit testUnit, List<String> methods,
            TestKind testKind, String lineDelimiter) throws CoreException {
        final String typeName = testUnit.getElementName().replace(".java", "");
        final StringBuilder buf = new StringBuilder();
        buf.append("public class ").append(typeName).append(" {").append(lineDelimiter);
        final Set<String> addedMethods = new HashSet<>();
        for (final String method : methods) {
            buf.append(constructMethodStub(testUnit, testKind, addedMethods, method, lineDelimiter))
                .append(lineDelimiter);
        }
        buf.append("}").append(lineDelimiter);
        return buf.toString();
    }

    private static String constructMethodStub(ICompilationUnit testUnit, TestKind testKind,
            Set<String> addedMethods, String method, String lineDelimiter) {
        final StringBuilder buf = new StringBuilder();
        buf.append("@Test").append(lineDelimiter);
        if (testKind == TestKind.JUnit) {
            buf.append("public ");
        }
        final String methodName = getUniqueMethodName(null, Collections.emptyMap(),
                addedMethods, getTestMethodName(method), false);
        addedMethods.add(methodName);
        buf.append("void ").append(methodName).append("() {").append(lineDelimiter).append(lineDelimiter).append("}");
        final String methodContent = buf.toString();
        // TODO: get test unit options directly
        return CodeFormatterUtil.format(CodeFormatter.K_STATEMENTS, methodContent, 1,
                lineDelimiter, testUnit.getJavaProject().getOptions(true));
    }

    private static IClasspathEntry getTestClasspathEntry(IJavaProject javaProject, ICompilationUnit unit)
            throws JavaModelException {
        // In most cases, this is the classpath entry used for testing, we first find the target entry by hard-code
        // to avoid go into the generated entries.
        IClasspathEntry testEntry = javaProject.getClasspathEntryFor(
            javaProject.getPath().append("src/test/java"));
        if (testEntry != null && ProjectTestUtils.isTestEntry(testEntry)) {
            return testEntry;
        }

        final IClasspathEntry[] entries = javaProject.readRawClasspath();
        for (final IClasspathEntry entry : entries) {
            if (ProjectTestUtils.isTestEntry(entry)) {
                return entry;
            }

            if (entry.getPath().isPrefixOf(unit.getPath())) {
                testEntry = entry;
            }
        }
        
        return testEntry;
    }

    private static String getTestFullyQualifiedName(ITypeBinding typeBinding, IJavaProject project,
            IClasspathEntry testEntry) throws JavaModelException {
        final String promptName = getDefaultTestFullyQualifiedName(typeBinding, project, testEntry);
        final String fullyQualifiedName = (String) JUnitPlugin.askClientForInput(
            "Please type the target test class name", promptName);
        if (fullyQualifiedName == null) {
            return null;
        }

        final IStatus status = JavaConventions.validateJavaTypeName(fullyQualifiedName,
                project.getOption(JavaCore.COMPILER_SOURCE, true),
                project.getOption(JavaCore.COMPILER_COMPLIANCE, true),
                project.getOption(JavaCore.COMPILER_PB_ENABLE_PREVIEW_FEATURES, true)
        );

        final int severity = status.getSeverity();
        if (severity == IStatus.OK || severity == IStatus.WARNING) {
            return fullyQualifiedName;
        }

        JavaLanguageServerPlugin.getInstance().getClientConnection().showNotificationMessage(MessageType.Error,
                status.getMessage());
        return null;
    }

    private static String getDefaultTestFullyQualifiedName(ITypeBinding typeBinding, IJavaProject project,
            IClasspathEntry testEntry) throws JavaModelException {
        final String defaultName = typeBinding.getBinaryName() + "Test";
        final String attemptName = typeBinding.getBinaryName() + "Tests";
        try {
            ICompilationUnit testCompilationUnit = getTestCompilationUnit(project, testEntry, attemptName);
            if (testCompilationUnit.exists()) {
                return attemptName;
            }

            testCompilationUnit = getTestCompilationUnit(project, testEntry, defaultName);
            if (testCompilationUnit.exists()) {
                return defaultName;
            }

            // check the majority naming under the package and use it as the default type name
            final IPackageFragment packageFragment = (IPackageFragment) testCompilationUnit.getParent();
            int counter = 0;
            final ICompilationUnit[] compilationUnits = packageFragment.getCompilationUnits();
            for (final ICompilationUnit unit : compilationUnits) {
                final String name = unit.getElementName();
                if (name.endsWith("Tests.java")) {
                    counter++;
                } else if (name.endsWith("Test.java")) {
                    counter--;
                }
            }
    
            if (counter > 0) {
                return attemptName;
            }
        } catch (JavaModelException e) {
            // ignore exception, for example: when packageFragment does not exist
        }

        return defaultName;
    }

    private static ICompilationUnit getTestCompilationUnit(IJavaProject javaProject, IClasspathEntry testEntry,
            String testFullyQualifiedName) throws JavaModelException {
        final IPackageFragmentRoot packageRoot = javaProject.findPackageFragmentRoot(testEntry.getPath());
        final int lastDelimiterIndex = testFullyQualifiedName.lastIndexOf(".");
        final String packageQualifiedName = lastDelimiterIndex < 0 ? "" : testFullyQualifiedName.substring(0,
                testFullyQualifiedName.lastIndexOf("."));
        final IPackageFragment packageFragment = packageRoot.getPackageFragment(packageQualifiedName);
        final String compilationUnitName = testFullyQualifiedName.substring(
                testFullyQualifiedName.lastIndexOf(".") + 1) + ".java";
        final ICompilationUnit testUnit = packageFragment.getCompilationUnit(compilationUnitName);
        return testUnit;
    }

    private static List<String> getMethodsToTest(ITypeBinding typeBinding) {
        final List<IMethodBinding> allMethods = new LinkedList<>();
        final List<Option> options = new LinkedList<>();
        final IMethodBinding[] typeMethods = typeBinding.getDeclaredMethods();
        for (final IMethodBinding method : typeMethods) {
            final int modifiers = method.getModifiers();
            if (!method.isConstructor() && !Modifier.isPrivate(modifiers) && !method.isSynthetic()) {
                allMethods.add(method);
            }
        }
        options.addAll(allMethods.stream()
            .map(method -> {
                final String returnValue = method.getReturnType().getName();
                final ITypeBinding[] paramTypes = method.getParameterTypes();
                final String params = String.join(", ",
                        Arrays.stream(paramTypes).map(t -> t.getName()).toArray(String[]::new));
                return new Option(method.getName(), method.getName() + "(" + params + ")", ": " + returnValue, false);
            })
            .sorted((methodA, methodB) -> {
                return methodA.label.compareTo(methodB.label);
            })
            .collect(Collectors.toList())
        );

        ITypeBinding superClass = typeBinding.getSuperclass();
        while (superClass != null && !"java.lang.Object".equals(superClass.getBinaryName())) {
            // iterate the declared methods and add them into the option list in each loop,
            // this is to make sure methods from each super class will be grouped together
            allMethods.clear();
            for (final IMethodBinding method: superClass.getDeclaredMethods()) {
                if (!method.isConstructor() && !method.isSynthetic() && isAccessible(method, typeBinding)) {
                    allMethods.add(method);
                }
            }
            options.addAll(allMethods.stream()
                .map(method -> {
                    final String returnValue = method.getReturnType().getName();
                    final ITypeBinding[] paramTypes = method.getParameterTypes();
                    final String params = String.join(", ",
                            Arrays.stream(paramTypes).map(t -> t.getName()).toArray(String[]::new));
                    final String description = ": " + returnValue + " (" + method.getDeclaringClass().getName() + ")";
                    return new Option(method.getName(), method.getName() + "(" + params + ")", description, true);
                })
                .sorted((methodA, methodB) -> {
                    return methodA.label.compareTo(methodB.label);
                })
                .collect(Collectors.toList())
            );
            superClass = superClass.getSuperclass();
        }

        if (options.size() == 0) {
            return Collections.emptyList();
        }

        final boolean hasInheritedMethods = options.stream().anyMatch(o -> o.isAdvanced);
        if (hasInheritedMethods) {
            return (List<String>) JUnitPlugin.advancedAskClientForChoice("Select the methods to test",
                    options, "inherited methods", true /*pickMany*/);
        }
        return (List<String>) JUnitPlugin.askClientForChoice("Select the methods to test",
                options, true /*pickMany*/);
    }

    private static String getTestMethodName(String methodName) {
        return "test" + Character.toUpperCase(methodName.charAt(0)) + methodName.substring(1);
    }

    private static WorkspaceEdit generateTestsFromTest(ICompilationUnit unit, CompilationUnit root,
            TypeDeclaration typeNode, ITypeBinding typeBinding, int cursorOffset)
            throws MalformedTreeException, CoreException {
        final Set<TestKind> availableFrameworks = getTestKindFromFile(unit);
        if (availableFrameworks.size() == 0) {
            availableFrameworks.addAll(TestKindProvider.getTestKindsFromCache(unit.getJavaProject()));
        }

        final TestKind testKind = determineTestFramework(availableFrameworks);
        if (testKind == null) {
            return null;
        }

        final List<String> lifecycleAnnotations = getLifecycleAnnotations(testKind);
        final List<String> methodsToGenerate = determineMethodsToGenerate(lifecycleAnnotations);

        if (methodsToGenerate == null || methodsToGenerate.size() == 0) {
            return null;
        }

        IJavaElement insertPosition = null; // Insert to the last by default.
        try {
            insertPosition = CodeGenerationUtils.findInsertElement(
                        (IType) typeBinding.getJavaElement(), cursorOffset);
        } catch (Throwable e) {
            // ignore if the upstream does not support insert position preference.
        }

        final TextEdit textEdit = createTextEditFromTestFile(testKind, methodsToGenerate, root, typeNode,
                typeBinding, insertPosition);
        return SourceAssistProcessor.convertToWorkspaceEdit(unit, textEdit);
    }

    private static List<String> determineMethodsToGenerate(List<String> lifecycleAnnotations) {
        final List<Option> methodList = lifecycleAnnotations.stream()
                .map(annotation -> new Option(annotation, "@" + annotation, 
                        capitalize(getSuggestedMethodNameByAnnotation(annotation)) + " Method"))
                .collect(Collectors.toList());
        final Option testMethod = new Option("Test", "@Test", "Test Method");
        testMethod.picked = true;
        methodList.add(0, testMethod);
        return (List<String>) JUnitPlugin.askClientForChoice("Select methods to generate",
                methodList, true /*pickMany*/);
    }

    private static IJavaProject determineTestProject(ICompilationUnit unit) {
        final IJavaProject javaProject = unit.getJavaProject();
        if (TestKindProvider.getTestKindsFromCache(javaProject).size() > 0) {
            return javaProject;
        }

        final IJavaProject[] javaProjects = ProjectUtils.getJavaProjects();
        final List<Option> javaTestProjects = new LinkedList<>();
        for (final IJavaProject project : javaProjects) {
            if (project.equals(JavaLanguageServerPlugin.getProjectsManager().getDefaultProject())) {
                continue;
            }
            if (TestKindProvider.getTestKindsFromCache(project).size() > 0) {
                javaTestProjects.add(new Option(project.getHandleIdentifier(), project.getElementName(),
                    project.getProject().getLocation().toOSString()));
            }
        }

        if (javaTestProjects.size() == 0) {
            JavaLanguageServerPlugin.getInstance().getClientConnection().showNotificationMessage(MessageType.Error,
                "No test library found in your workspace, please add a test library to your project classpath first.");
            return null;
        }
        final Object result = JUnitPlugin.askClientForChoice("Select a project where tests are generated in",
                javaTestProjects);
        if (result == null) {
            return null;
        }
        return (IJavaProject) JavaCore.create((String) result);
    }

    private static TestKind determineTestFramework(Set<TestKind> availableFrameworks) throws CoreException {
        if (availableFrameworks.size() == 0) {
            JavaLanguageServerPlugin.getInstance().getClientConnection().showNotificationMessage(MessageType.Error,
                    "Cannot find a unit test framework in the project, please make sure it's on the classpath.");
            return null;
        }
        if (availableFrameworks.size() == 1) {
            return availableFrameworks.iterator().next();
        } else {
            final List<Option> frameworkList = availableFrameworks.stream()
                .sorted((kind1, kind2) -> kind1.getValue() - kind2.getValue())
                .map(framework -> new Option(framework.toString()))
                .collect(Collectors.toList());

            final Object result = JUnitPlugin.askClientForChoice("Select a test framework to use", frameworkList);
            if (result == null) {
                return null;
            }
            return TestKind.fromString(((String) result));
        }
    }

    private static Set<TestKind> getTestKindFromFile(ICompilationUnit unit) throws JavaModelException {
        final IImportDeclaration[] imports = unit.getImports();
        final Set<TestKind> testKindsInFile = new HashSet<>();
        for (final IImportDeclaration importDeclaration : imports) {
            final String importPackage = importDeclaration.getElementName();
            if (importPackage.startsWith(JUNIT5_PREFIX)) {
                testKindsInFile.add(TestKind.JUnit5);
            } else if (importPackage.startsWith(JUNIT4_PREFIX)) {
                testKindsInFile.add(TestKind.JUnit);
            } else if (importPackage.startsWith(TESTNG_PREFIX)) {
                testKindsInFile.add(TestKind.TestNG);
            }
        }
        return testKindsInFile;
    }

    private static TextEdit createTextEditFromTestFile(TestKind kind, List<String> methodsToGenerate,
            CompilationUnit root, TypeDeclaration typeNode, ITypeBinding typeBinding, IJavaElement insertPosition)
            throws MalformedTreeException, CoreException {
        String annotationPrefix = "";
        if (kind == TestKind.JUnit) {
            annotationPrefix = JUNIT4_LIFECYCLE_ANNOTATION_PREFIX;
        } else if (kind == TestKind.JUnit5) {
            annotationPrefix = JUNIT5_LIFECYCLE_ANNOTATION_PREFIX;
        } else if (kind == TestKind.TestNG) {
            annotationPrefix = TESTNG_LIFECYCLE_ANNOTATION_PREFIX;
        }

        final String prefix = annotationPrefix;
        final List<MethodMetaData> metadata = methodsToGenerate.stream().map(annotationName -> {
            final String methodName = getSuggestedMethodNameByAnnotation(annotationName);
            return new MethodMetaData(methodName, prefix + annotationName);
        }).collect(Collectors.toList());

        return getTextEdit(kind, metadata, root, typeNode, typeBinding, insertPosition, true /*fromTest*/);
    }

    private static TextEdit getTextEdit(TestKind kind, List<MethodMetaData> methodMetadata, CompilationUnit root,
            TypeDeclaration typeNode, ITypeBinding typeBinding, IJavaElement insertPosition, boolean fromTest)
            throws CoreException {
        final ASTRewrite astRewrite = ASTRewrite.create(root.getAST());
        final ImportRewrite importRewrite = StubUtility.createImportRewrite(root, true);
        final ListRewrite listRewrite = astRewrite.getListRewrite(typeNode,
                ((AbstractTypeDeclaration) typeNode).getBodyDeclarationsProperty());
        final AST ast = astRewrite.getAST();
        final Map<String, IMethodBinding> methodsMap = getMethodsBindings(typeBinding);
        final Set<String> addedMethods = new HashSet<>();
        for (final MethodMetaData method : methodMetadata) {
            final MethodDeclaration decl = ast.newMethodDeclaration();

            final boolean isStatic = needStaticModifier(kind, method.annotation);
            // set a unique method name according to the annotation type
            final String methodName = getUniqueMethodName(typeBinding.getJavaElement(), methodsMap,
                    addedMethods, method.methodName, isStatic);
            addedMethods.add(methodName);
            decl.setName(ast.newSimpleName(methodName));

            decl.modifiers().addAll(ASTNodeFactory.newModifiers(ast, getTestMethodModifiers(methodsMap, kind,
                    method.annotation, methodName)));
            decl.setConstructor(false);
            decl.setReturnType2(ast.newPrimitiveType(PrimitiveType.VOID));

            final Block body = ast.newBlock();
            // add a empty line in the method body
            body.statements().add(astRewrite.createStringPlaceholder("", ASTNode.EMPTY_STATEMENT));
            decl.setBody(body);

            // add the annotation and update the imports
            final Annotation marker = ast.newMarkerAnnotation();
            final ImportRewriteContext context = new ContextSensitiveImportRewriteContext(root,
                    decl.getStartPosition(), importRewrite);
            marker.setTypeName(ast.newName(importRewrite.addImport(method.annotation, context)));
            astRewrite.getListRewrite(decl, MethodDeclaration.MODIFIERS2_PROPERTY).insertFirst(marker, null);

            if (needsOverrideAnnotation(isStatic, methodsMap.get(methodName), typeBinding)) {
                final CodeGenerationSettings settings = new CodeGenerationSettings();
                settings.overrideAnnotation = true;
                StubUtility2Core.addOverrideAnnotation(settings, root.getJavaElement().getJavaProject(), astRewrite,
                        importRewrite, decl, typeBinding.isInterface(), null);
            }

            final ASTNode insertion = StubUtility2Core.getNodeToInsertBefore(listRewrite, insertPosition);
            // Only try to insert according to the cursor position when it's triggered from test file,
            // If it's triggered from source file, since code snippets will be generated into a new file,
            // they will always insert to the last.
            if (insertion != null && fromTest) {
                listRewrite.insertBefore(decl, insertion, null);
            } else {
                listRewrite.insertLast(decl, null);
            }
        }

        final MultiTextEdit edit = new MultiTextEdit();
        edit.addChild(importRewrite.rewriteImports(null));
        edit.addChild(astRewrite.rewriteAST());
        return edit;
    }

    private static List<String> getLifecycleAnnotations(TestKind testKind) {
        final List<String> list = new ArrayList<>();
        switch (testKind) {
            case JUnit:
                list.add(JUNIT4_BEFORE_CLASS_ANNOTATION);
                list.add(JUNIT4_SET_UP_ANNOTATION);
                list.add(JUNIT4_TEAR_DOWN_ANNOTATION);
                list.add(JUNIT4_AFTER_CLASS_ANNOTATION);
                break;
            case JUnit5:
                list.add(JUNIT5_BEFORE_CLASS_ANNOTATION);
                list.add(JUNIT5_SET_UP_ANNOTATION);
                list.add(JUNIT5_TEAR_DOWN_ANNOTATION);
                list.add(JUNIT5_AFTER_CLASS_ANNOTATION);
                break;
            case TestNG:
                list.add(TESTNG_BEFORE_CLASS_ANNOTATION);
                list.add(TESTNG_SET_UP_ANNOTATION);
                list.add(TESTNG_TEAR_DOWN_ANNOTATION);
                list.add(TESTNG_AFTER_CLASS_ANNOTATION);
                break;
            default:
                break;
        }
        return list;
    }

    private static String getSuggestedMethodNameByAnnotation(String annotation) {
        switch (annotation) {
            case JUNIT4_BEFORE_CLASS_ANNOTATION:
            case JUNIT5_BEFORE_CLASS_ANNOTATION:
            // TestNG has the same annotation name with JUnit 4
            // case TESTNG_BEFORE_CLASS_ANNOTATION:
                return "beforeClass";
            case JUNIT4_AFTER_CLASS_ANNOTATION:
            case JUNIT5_AFTER_CLASS_ANNOTATION:
            // TestNG has the same annotation name with JUnit 4
            // case TESTNG_AFTER_CLASS_ANNOTATION:
                return "afterClass";
            case JUNIT4_SET_UP_ANNOTATION:
            case JUNIT5_SET_UP_ANNOTATION:
            case TESTNG_SET_UP_ANNOTATION:
                return "setUp";
            case JUNIT4_TEAR_DOWN_ANNOTATION:
            case JUNIT5_TEAR_DOWN_ANNOTATION:
            case TESTNG_TEAR_DOWN_ANNOTATION:
                return "tearDown";
            default:
                return "testName";
        }
    }

    /**
     * return modifier bit mask.
     */
    private static int getTestMethodModifiers(Map<String, IMethodBinding> methodsMap, TestKind kind,
            String annotation, String methodName) {
        int modifiers = Modifier.NONE;

        // @BeforeClass and @AfterClass in JUnit 4 & 5 needs static modifier
        if (needStaticModifier(kind, annotation)) {
            modifiers |= Modifier.STATIC;
        }

        // JUnit 4's test method must be public
        if (kind == TestKind.JUnit) {
            modifiers |= Modifier.PUBLIC;
            return modifiers;
        }

        final IMethodBinding binding = methodsMap.get(methodName);
        if (binding == null) {
            return modifiers;
        }

        final int superModifiers = binding.getModifiers();
        if (Modifier.isProtected(superModifiers)) {
            modifiers |= Modifier.PROTECTED;
        } else if (Modifier.isPublic(superModifiers)) {
            modifiers |= Modifier.PUBLIC;
        }

        return modifiers;
    }

    private static Map<String, IMethodBinding> getMethodsBindings(ITypeBinding typeBinding) {
        final Map<String, IMethodBinding> methods = new HashMap<>();
        final IMethodBinding[] typeMethods = typeBinding.getDeclaredMethods();
        for (final IMethodBinding methodBinding : typeMethods) {
            methods.put(methodBinding.getName(), methodBinding);
        }
        ITypeBinding superClass = typeBinding.getSuperclass();
        while (superClass != null) {
            for (final IMethodBinding methodBinding : superClass.getDeclaredMethods()) {
                if (methods.containsKey(methodBinding.getName())) {
                    continue;
                }

                if (!isAccessible(methodBinding, typeBinding)) {
                    continue;
                }

                methods.put(methodBinding.getName(), methodBinding);
            }
            superClass = superClass.getSuperclass();
        }
        return methods;
    }

    private static boolean isAccessible(IMethodBinding superMethod, ITypeBinding declaredType) {
        final int modifiers = superMethod.getModifiers();
        if (Modifier.isPrivate(modifiers)) {
            return false;
        }

        if (!Modifier.isProtected(modifiers) && !Modifier.isPublic(modifiers)) {
            final IPackageBinding superMethodPackage = superMethod.getDeclaringClass().getPackage();
            final IPackageBinding declaredPackage = declaredType.getPackage();
            return superMethodPackage != null && declaredPackage != null &&
                    superMethodPackage.getName().equals(declaredPackage.getName());
        }

        return true;
    }

    private static boolean needStaticModifier(TestKind kind, String annotation) {
        if (annotation == null) {
            return false;
        }

        if (kind == TestKind.TestNG) {
            return false;
        }

        annotation = annotation.substring(annotation.lastIndexOf(".") + 1);
        if (kind == TestKind.JUnit) {
            switch (annotation) {
                case JUNIT4_BEFORE_CLASS_ANNOTATION:
                case JUNIT4_AFTER_CLASS_ANNOTATION:
                    return true;
                default:
                    return false;
            }
        }

        if (kind == TestKind.JUnit5) {
            switch (annotation) {
                case JUNIT5_BEFORE_CLASS_ANNOTATION:
                case JUNIT5_AFTER_CLASS_ANNOTATION:
                    return true;
                default:
                    return false;
            }
        }

        return false;
    }

    private static boolean needsOverrideAnnotation(boolean isStatic, IMethodBinding methodBinding,
            ITypeBinding declaredType) {
        if (isStatic) {
            return false;
        }

        if (methodBinding == null) {
            return false;
        }
        if (Objects.equals(declaredType.getBinaryName(), methodBinding.getDeclaringClass().getBinaryName())) {
            return false;
        }
        return true;
    }

    private static String getTestAnnotation(TestKind testKind) {
        if (testKind == TestKind.JUnit) {
            return JUNIT4_LIFECYCLE_ANNOTATION_PREFIX + "Test";
        } else if (testKind == TestKind.TestNG) {
            return TESTNG_LIFECYCLE_ANNOTATION_PREFIX + "Test";
        }

        return JUNIT5_LIFECYCLE_ANNOTATION_PREFIX + "Test";
    }

    private static String getUniqueMethodName(IJavaElement type, Map<String, IMethodBinding> methodsMap,
            Set<String> addedMethods, String suggestedName, boolean isStatic) {
        IMethod[] methods = null;
        if (type instanceof IType) {
            try {
                methods = ((IType) type).getMethods();
            } catch (JavaModelException e) {
                // ignore
            }
        }

        if (methods == null) {
            methods = new IMethod[0];

        }

        int suggestedPostfix = 0;
        String resultName = suggestedName;
        while (suggestedPostfix < 1000) {
            suggestedPostfix++;
            resultName = suggestedPostfix > 1 ? suggestedName + suggestedPostfix : suggestedName;
            if (hasMethod(methods, addedMethods, resultName)) {
                continue;
            }
            final IMethodBinding superMethod = methodsMap.get(resultName);
            if (superMethod == null) {
                return resultName;
            }
            if (!"void".equals(superMethod.getReturnType().getName())) {
                continue;
            }
            final int modifier = superMethod.getModifiers();
            if (Modifier.isFinal(modifier)) {
                continue;
            }
            if (Modifier.isStatic(modifier) != isStatic) {
                continue;
            }
            return resultName;
        }

        return suggestedName;
    }

    private static boolean hasMethod(IMethod[] methods, Set<String> addedMethods, String name) {
        if (addedMethods.contains(name)) {
            return true;
        }

        for (final IMethod method : methods) {
            if (name.equals(method.getElementName())) {
                return true;
            }
        }
        return false;
    }

    private static String capitalize(String str) {
        return Character.toUpperCase(str.charAt(0)) + str.substring(1);
    }

    static class MethodMetaData {
        public String methodName;
        public String annotation;

        public MethodMetaData(String methodName, String annotation) {
            this.methodName = methodName;
            this.annotation = annotation;
        }
    }
}
