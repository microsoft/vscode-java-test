/*******************************************************************************
 * Copyright (c) 2022 Microsoft Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Microsoft Corporation - initial API and implementation
 *******************************************************************************/

package com.microsoft.java.test.plugin.model.builder;

import com.microsoft.java.test.plugin.model.JavaTestItem;
import com.microsoft.java.test.plugin.model.TestKind;
import com.microsoft.java.test.plugin.model.TestLevel;
import com.microsoft.java.test.plugin.util.TestItemUtils;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.IPath;
import org.eclipse.jdt.core.IClassFile;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.internal.core.BinaryMember;
import org.eclipse.jdt.internal.core.BinaryMethod;
import org.eclipse.jdt.internal.core.BinaryType;
import org.eclipse.jdt.internal.core.PackageFragmentRoot;
import org.eclipse.jdt.internal.core.manipulation.JavaElementLabelsCore;
import org.eclipse.jdt.ls.core.internal.JDTUtils;
import org.eclipse.jdt.ls.core.internal.JavaLanguageServerPlugin;
import org.eclipse.jdt.ls.core.internal.ProjectUtils;
import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.Range;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.Label;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

/**
 * Builder class to build {@link com.microsoft.java.test.plugin.model.JavaTestItem}
 */
public class JavaTestItemBuilder {
    private static final String DEFAULT_PACKAGE_NAME = "<Default Package>";

    private IJavaElement element;
    private TestLevel level;
    private TestKind kind;
    private String displayName;

    public JavaTestItemBuilder setJavaElement(IJavaElement element) {
        this.element = element;
        return this;
    }

    public JavaTestItemBuilder setLevel(TestLevel level) {
        this.level = level;
        return this;
    }

    public JavaTestItemBuilder setKind(TestKind kind) {
        this.kind = kind;
        return this;
    }

    public JavaTestItemBuilder setDisplayName(String displayName) {
        this.displayName = displayName;
        return this;
    }

    public JavaTestItem build() throws JavaModelException {
        if (this.element == null || this.level == null || this.kind == null) {
            throw new IllegalArgumentException("Failed to build Java test item due to missing arguments");
        }

        String uri = null;
        if (this.displayName == null) {
            if (this.element instanceof IJavaProject) {
                final IJavaProject javaProject = (IJavaProject) this.element;
                final IProject project = javaProject.getProject();
                if (ProjectUtils.isVisibleProject(project)) {
                    displayName = project.getName();
                } else {
                    final IPath realPath = ProjectUtils.getProjectRealFolder(project);
                    displayName = realPath.lastSegment();
                    uri = realPath.toFile().toURI().toString();
                }
            } else if (this.element instanceof IPackageFragment &&
                    ((IPackageFragment) this.element).isDefaultPackage()) {
                displayName = DEFAULT_PACKAGE_NAME;
                final IResource resource = getResource((IPackageFragment) this.element);
                if (resource == null || !resource.exists()) {
                    return null;
                }
                uri = JDTUtils.getFileURI(resource);
            } else {
                displayName = JavaElementLabelsCore.getElementLabel(this.element, JavaElementLabelsCore.ALL_DEFAULT);
            }
        }
        Range range = null;
        final String fullName = TestItemUtils.parseFullName(this.element, this.level, this.kind);
        if (uri == null) {
            IResource resource = this.element.getResource();
            if (resource == null && this.element instanceof IPackageFragment) {
                resource = getResource((IPackageFragment) this.element);
            }
            if (resource == null || !resource.exists()) {
                return null;
            }
            if (element instanceof BinaryMember) {
                final String[] sources = new String[1];
                final int[] lines = {-1};
                final IClassFile classFile = ((BinaryMember) element).getClassFile();
                try (InputStream is = new ByteArrayInputStream(classFile.getBytes())) {
                    final ClassReader cr = new ClassReader(is);
                    if (element instanceof BinaryType) {
                        cr.accept(new ClassVisitor(Opcodes.ASM9) {
                            @Override
                            public void visitSource(String source, String debug) {
                                sources[0] = source;
                            }
                        }, ClassReader.SKIP_CODE | ClassReader.SKIP_FRAMES);
                    } else if (element instanceof BinaryMethod) {
                        final String methodDescriptor = ((BinaryMethod) element).getSignature();
                        cr.accept(new ClassVisitor(Opcodes.ASM9) {
                            @Override
                            public void visitSource(String source, String debug) {
                                sources[0] = source;
                            }
        
                            public MethodVisitor visitMethod(int access, String name, String descriptor,
                                    String signature, String[] exceptions) {
                                if (name.equals(element.getElementName()) && descriptor.equals(methodDescriptor)) {
                                    return new MethodVisitor(Opcodes.ASM9) {
                                        @Override
                                        public void visitLineNumber(int line, Label start) {
                                            if (lines[0] < 0) {
                                                lines[0] = line;
                                                if (line > 0) {
                                                    lines[0]--;
                                                }
                                            }
                                        }
                                    };
                                }
                                return null;
                            }
                        }, ClassReader.SKIP_FRAMES);
                    }
                } catch (Exception e) {
                    JavaLanguageServerPlugin.logException(e);
                }
                if (sources[0] != null) {
                    final IPackageFragment packageFragment = (IPackageFragment) element
                            .getAncestor(IJavaElement.PACKAGE_FRAGMENT);
                    if (packageFragment != null) {
                        final String packageName = packageFragment.getElementName();
                        final IJavaProject project = element.getJavaProject();
                        final String packagePath = packageName.replace('.', '/');
                        for (final IClasspathEntry entry : project.getRawClasspath()) {
                            if (entry.getEntryKind() == IClasspathEntry.CPE_SOURCE) {
                                final IPath sourceFolderPath = entry.getPath();
                                final IPath fullPath = sourceFolderPath.append(packagePath).append(sources[0]);
                                final IResource candidate = ResourcesPlugin.getWorkspace().getRoot()
                                        .findMember(fullPath);
                                if (candidate != null && candidate.exists()) {
                                    resource = candidate;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (lines[0] > 0) {
                    final Position line = new Position(lines[0] - 1, 0);
                    range = new Range(line, line);
                }
            }
            if (uri == null) {
                uri = JDTUtils.getFileURI(resource);
            }
        }
        if (range == null && (this.level == TestLevel.CLASS || this.level == TestLevel.METHOD)) {
            range = TestItemUtils.parseTestItemRange(this.element);
        }

        final String projectName = this.element.getJavaProject().getProject().getName();
        final JavaTestItem result = new JavaTestItem(displayName, fullName, projectName, uri, range, level, this.kind);
        result.setJdtHandler(this.element.getHandleIdentifier());

        return result;
    }

    private IResource getResource(IPackageFragment packageFragment) {
        if (packageFragment == null) {
            return null;
        }
        IResource resource = packageFragment.getResource();
        if (resource == null) {
            final IJavaElement e = packageFragment.getParent();
            if (e instanceof PackageFragmentRoot) {
                final PackageFragmentRoot root = (PackageFragmentRoot) e;
                resource = root.getResource();
                if (resource == null) {
                    resource = root.resource(root);
                }
            }
        }
        return resource;
    }
}
