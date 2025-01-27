If you’re new to open source or interested in contributing, this guide is
particularly helpful:
[How to Contribute to Open Source](https://opensource.guide/how-to-contribute/).

## Contributing Code

To contribute to this repo, start by creating a GitHub Issue, which will allow
you to gather feedback before writing any code. In the Issues tab, you’ll be
able to select from a template to create an Issue.

To create a Pull Request after you’ve created an Issue, you’ll need to head over
to the Pull Request tab. This will be where all the PRs will be located, and
where reviewers will be able to review your changes made.

### Before submitting a PR

-   Run `git submodule update --init --recursive`, this will ensure you are using
    the latest versions of the submodules. 
-   If you are adding new tests, you need to update the following sections of the
    [`init.sh`](init.sh) script:
    - Add a function for the new set of tests such as [this one](init.sh#L50-L75).
    - Update the [`run_all_tests`](init.sh#L77-L111) function to include the new
    tests.
    - Update the `$test` cases in the [chain selector](init.sh#L287-L404) to include
    the new test option.
    - Update the references in this file.
-   Run the [`init.sh`](init.sh) script to against ethereum and Westend by running:
    ```bash
    ./init.sh --ethereum
    ./init.sh --kitchensink -- -- -- <PATH_TO_NODE> <PATH_TO_ADAPTER> <PATH_TO_RESOLC>
    ```
    The only errors you should encounter can be of the sort `HardhatOnlyHelper`
    or `the initcode size of this transaction is too large`. These are expected
    until we can [add `polkavm` as a test network on hardhat](https://github.com/NomicFoundation/hardhat/issues/6191).
-   If everything looks good, push the changes.

## Rules

There are a few basic ground-rules for contributors (including the maintainer(s)
of the project):

- Try to avoid `--force` pushes or modifying the Git history in any way. If you
  need to rebase, ensure you do it in your own repo.
- Non-master branches, prefixed with a short name moniker (e.g.
  `gav-my-feature`), must be used for ongoing work.
- All modifications must be made in a Pull Request to solicit feedback from
  other contributors.
- Contributors should adhere to the
  [house coding style](https://github.com/paritytech/substrate/blob/master/docs/STYLE_GUIDE.md).

## Reviewing Pull Requests:

When reviewing a Pull Request, the end goal is to suggest useful changes to the
author. Reviews should finish with approval unless there are issues that would
result in:

- Buggy behaviour.
- Undue maintenance burden.
- Breaking with house coding style.
- Poor performance.
- Feature reduction (i.e. it removes some aspect of functionality that a
  significant minority of users rely on).
- Uselessness (i.e. it does not strictly add a feature or fix a known issue).

## Where to Ask for Help

Asking for help in the Parity community is encouraged and welcomed! The best
ways to reach us are:

- Ask a question in the [Substrate and Polkadot Stack Exchange](https://substrate.stackexchange.com/)

## Heritage

These contributing guidelines are modified from the "OPEN Open Source Project"
guidelines for the Level project:
https://github.com/Level/community/blob/master/CONTRIBUTING.md