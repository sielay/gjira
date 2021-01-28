Simple tool to make easy to do fast PRs based on issues in JIRA

![Gjira](gjira.gif)

### Install

```
yarn global add gjira
```

or

```
npm i -g gjira
```

### Setup

Run `gjira configure` and answer questions there.

You JIRA credentials are saved plain text in your HOME directory.

### Create branch 

Command `gjira PROJECT-123` will

 * Stash your changes
 * Checkout base branch (master)
 * Create new branch

### Push

 Command `gjira push` will

 * Stage your changes
 * Commit with JIRA message
 * Push to origin



MIT