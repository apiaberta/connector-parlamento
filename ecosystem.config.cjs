module.exports = {
  apps: [
    {
      name: 'apiaberta-parlamento',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3019,
        MONGO_URI: 'mongodb://localhost:27017/apiaberta-parlamento'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '300M'
    }
  ]
}
