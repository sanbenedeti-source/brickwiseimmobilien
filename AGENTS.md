<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployment workflow

The project owner requests production deployment after each completed, validated change. Deploy to the existing Vercel project linked in `.vercel/project.json`, then verify the production URL. Report any deployment blocker clearly; do not describe local changes as live until deployment succeeds.
