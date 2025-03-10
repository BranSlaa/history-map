# Supabase CLI (v1)

[![Coverage Status](https://coveralls.io/repos/github/supabase/cli/badge.svg?branch=main)](https://coveralls.io/github/supabase/cli?branch=main) [![Bitbucket Pipelines](https://img.shields.io/bitbucket/pipelines/supabase-cli/setup-cli/master?style=flat-square&label=Bitbucket%20Canary)](https://bitbucket.org/supabase-cli/setup-cli/pipelines) [![Gitlab Pipeline Status](https://img.shields.io/gitlab/pipeline-status/sweatybridge%2Fsetup-cli?label=Gitlab%20Canary)
](https://gitlab.com/sweatybridge/setup-cli/-/pipelines)

[Supabase](https://supabase.io) is an open source Firebase alternative. We're building the features of Firebase using enterprise-grade open source tools.

This repository contains all the functionality for Supabase CLI.

- [x] Running Supabase locally
- [x] Managing database migrations
- [x] Creating and deploying Supabase Functions
- [x] Generating types directly from your database schema
- [x] Making authenticated HTTP requests to [Management API](https://supabase.com/docs/reference/api/introduction)

## Getting started

### Install the CLI

Available via [NPM](https://www.npmjs.com) as dev dependency. To install:

```bash
npm i supabase --save-dev
```

To install the beta release channel:

```bash
npm i supabase@beta --save-dev
```

When installing with yarn 4, you need to disable experimental fetch with the following nodejs config.

```
NODE_OPTIONS=--no-experimental-fetch yarn add supabase
```

> **Note**
> For Bun versions below v1.0.17, you must add `supabase` as a [trusted dependency](https://bun.sh/guides/install/trusted) before running `bun add -D supabase`.

<details>
  <summary><b>macOS</b></summary>

Available via [Homebrew](https://brew.sh). To install:

```sh
brew install supabase/tap/supabase
```

To install the beta release channel:

```sh
brew install supabase/tap/supabase-beta
brew link --overwrite supabase-beta
```

To upgrade:

```sh
brew upgrade supabase
```

</details>

<details>
  <summary><b>Windows</b></summary>

Available via [Scoop](https://scoop.sh). To install:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

To upgrade:

```powershell
scoop update supabase
```

</details>

<details>
  <summary><b>Linux</b></summary>

Available via [Homebrew](https://brew.sh) and Linux packages.

#### via Homebrew

To install:

```sh
brew install supabase/tap/supabase
```

To upgrade:

```sh
brew upgrade supabase
```

#### via Linux packages

Linux packages are provided in [Releases](https://github.com/supabase/cli/releases). To install, download the `.apk`/`.deb`/`.rpm`/`.pkg.tar.zst` file depending on your package manager and run the respective commands.

```sh
sudo apk add --allow-untrusted <...>.apk
```

```sh
sudo dpkg -i <...>.deb
```

```sh
sudo rpm -i <...>.rpm
```

```sh
sudo pacman -U <...>.pkg.tar.zst
```

</details>

<details>
  <summary><b>Other Platforms</b></summary>

You can also install the CLI via [go modules](https://go.dev/ref/mod#go-install) without the help of package managers.

```sh
go install github.com/supabase/cli@latest
```

Add a symlink to the binary in `$PATH` for easier access:

```sh
ln -s "$(go env GOPATH)/bin/cli" /usr/bin/supabase
```

This works on other non-standard Linux distros.

</details>

<details>
  <summary><b>Community Maintained Packages</b></summary>

Available via [pkgx](https://pkgx.sh/). Package script [here](https://github.com/pkgxdev/pantry/blob/main/projects/supabase.com/cli/package.yml).
To install in your working directory:

```bash
pkgx install supabase
```

Available via [Nixpkgs](https://nixos.org/). Package script [here](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/supabase-cli/default.nix).

</details>

### Run the CLI

```bash
supabase bootstrap
```

Or using npx:

```bash
npx supabase bootstrap
```

The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

## Developing

To run from source:

```sh
# Go >= 1.22
go run . help
```

# History Map

An interactive history map application that integrates gamification elements, vector search capabilities, and user engagement through quizzes and rankings.

## Features

- **Interactive Historical Map**: Explore historical events on a dynamic map with event visualization
- **Gamified Quizzes**: Test your knowledge with quizzes tied to historical events and locations
- **User Rankings**: Compete with others based on quiz accuracy, engagement, and participation
- **Personalized Profiles**: Track your progress, achievements, and historical interactions
- **Vector Search**: Discover contextually relevant historical events using advanced search capabilities

## Tech Stack

- **Frontend**: Next.js with React and TypeScript
- **Styling**: Tailwind CSS for responsive and engaging UI/UX
- **Authentication**: Supabase for secure user authentication
- **Data Storage**: Supabase for storing user data, event data, and engagement metrics
- **Vector Search**: Supabase for efficient historical event search and contextual relationships

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository

    ```bash
    git clone https://github.com/yourusername/history-map.git
    cd history-map
    ```

2. Install dependencies

    ```bash
    npm install
    # or
    yarn install
    ```

3. Set up environment variables

    ```bash
    cp .env.example .env.local
    ```

    Then edit `.env.local` with your Supabase credentials.

4. Start the development server

    ```bash
    npm run dev
    # or
    yarn dev
    ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

```
history-map/
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── map/             # Map-related components
│   │   ├── quiz/            # Quiz-related components
│   │   └── ui/              # UI components
│   ├── context/             # React context providers
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── supabase/                # Supabase configuration and migrations
│   ├── migrations/          # Database migrations
│   └── functions/           # Supabase Edge Functions
└── tests/                   # Test files
```

## Development Guidelines

- **Code Style**: Use 4-space width tab characters for indentation
- **TypeScript**: Use strict type annotations
- **Version Control**: Follow Git best practices with feature branching
- **Documentation**: Include comments to explain 'why' something is done, not 'what' is being done
- **Testing**: Write unit tests for critical logic and components

## License

This project is licensed under the MIT License - see the LICENSE file for details.
