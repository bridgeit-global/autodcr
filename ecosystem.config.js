module.exports = {
  apps: [
    {
      name: "autodcr-local",
      cwd: "/Users/munib/Documents/DD",
      script: "npm",
      args: "run dev -- -p 3001",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "autodcr-ngrok",
      cwd: "/Users/munib/Documents/DD",
      script: "npx",
      args: "-y ngrok http 3001",
      autorestart: true,
      watch: false,
    },
  ],
};
