# Witsmith Context

Task: Add refresh-token validation

Relevant Witsmith memories:
- [high] When fixing OAuth token expiry mismatches, verify the actual timeout requirements in all dependent modules (like session.ts) rather than relying solely on external documentation. Cross-reference constants across multiple files to ensure consistency.
- [high] When fixing OAuth bugs, always verify that validation parameters in callback handlers match the actual implementation in session management modules.
- [high] npm test command failed with exit code 1 during Prisma generation phase, preventing validation of whether test-run.ts changes actually address the stated OAuth redirect bug.
