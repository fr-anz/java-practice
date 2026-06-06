# Java Hands-on Reviewer

A simple web-based Java console practice app for hands-on exam review.

## Features

- Monaco-based Java code editor
- `Run Code` executes the program with sample input
- `Submit Answer` checks output, hidden tests, and required concepts
- Java runner with timeout, output limit, and basic security checks

## Requirements

- Node.js
- npm
- Java JDK with `javac` and `java` available in the terminal

## Install

```bash
npm install
```

## Run Locally

Start the backend API:

```bash
npm run server
```

Start the frontend dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

The frontend proxies API requests to:

```text
http://localhost:3001
```

## Build

```bash
npm run build
```

## How Checking Works

The checker compiles and runs submitted Java code as `Main.java`.

It checks:

- compilation
- visible and hidden test output values
- `Scanner`
- `if-else`
- `switch`
- user-defined methods
- exception handling
- closing the Scanner object

The required values must appear in the console output.

## Notes

- Student code must use `public class Main`.
- Hidden tests are not exposed through the problem API.
- The Run and Submit endpoints block restricted Java keywords such as file, network, process, and forced-exit operations.
