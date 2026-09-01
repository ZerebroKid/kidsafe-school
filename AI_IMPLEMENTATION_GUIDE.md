
# AI Implementation Guide

## Objective

Implement new features and UI into the existing React Native project while preserving the current architecture, business logic, navigation, APIs, Firebase integration, and coding standards.

The goal is to extend the project, not rebuild it.

---

# Before You Start

Before writing any code:

- Read all relevant project documentation.
- Read all related HTML/UI design files.
- Understand the existing implementation.
- Inspect reusable components before creating new ones.

Never start coding without understanding the existing codebase.

---

# Source of Truth

The HTML/Figma designs are the source of truth for the visual UI.

The existing React Native project is the source of truth for:

- Architecture
- Navigation
- Business Logic
- APIs
- Firebase
- State Management
- Project Structure

If there is any conflict, preserve the existing application architecture while implementing the new UI.

---

# Development Rules

Always:

- Reuse existing components.
- Reuse existing hooks.
- Reuse existing services.
- Reuse existing utilities.
- Extend existing files whenever possible.

Avoid:

- Duplicate code
- Duplicate components
- Duplicate services
- Unnecessary refactoring
- Breaking existing functionality

---

# UI Rules

Implement pixel-perfect UI.

Match:

- Colors
- Typography
- Spacing
- Icons
- Images
- Layout
- Animations

Use the existing design system whenever possible.

Do not hardcode colors, spacing, or typography.

---

# Code Quality

Write clean, maintainable, production-ready code.

Follow:

- TypeScript
- Functional Components
- Hooks
- Existing project conventions
- SOLID principles

Remove:

- Dead code
- Unused imports
- Duplicate logic

---

# Performance

Prefer:

- React.memo
- useMemo
- useCallback
- FlatList
- Optimized rendering

Avoid unnecessary re-renders.

---

# API Rules

Never invent APIs.

Never invent Firestore fields.

Always follow the existing service and type structure.

If backend support is missing, leave a clear TODO.

---

# Testing

Before completing any task:

- Verify functionality
- Run TypeScript
- Run ESLint
- Test the affected screens
- Ensure existing features still work

---

# Git Workflow

After completing each logical task:

- Review the changes.
- Stage the relevant files.
- Create a meaningful Git commit.

Commit frequently in small logical units.

Never leave completed work uncommitted.

Do not push to a remote repository unless explicitly instructed.

---

# Final Checklist

Before marking any task complete:

- Existing functionality preserved
- Pixel-perfect UI
- No duplicate code
- No unused imports
- TypeScript passes
- ESLint passes
- Responsive layout
- Production-ready implementation

---

# Mindset

Think like a senior React Native engineer.

Prioritize:

- Maintainability
- Scalability
- Performance
- Readability
- Consistency

Always make the smallest change necessary to accomplish the task.
