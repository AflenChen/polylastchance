/**
 * PM2 进程管理器配置文件
 * 用于在生产服务器上运行 Next.js 应用
 * 
 * 使用方法：
 * 1. 修改 cwd 路径为你的实际项目路径
 * 2. 根据需要修改环境变量
 * 3. 运行: pm2 start ecosystem.config.js
 * 4. 运行: pm2 save
 * 5. 运行: pm2 startup (然后执行输出的命令)
 */

module.exports = {
  apps: [{
    name: 'polylastchance',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/polylastchance/eventtimer-nextjs', // 修改为你的实际路径
    instances: 1, // 单实例运行，如果服务器性能好可以增加
    exec_mode: 'fork', // fork 模式，适合 Next.js
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // 如果需要配置 CORS，取消下面的注释并设置你的域名
      // ALLOWED_ORIGIN: 'https://yourdomain.com'
    },
    // 日志配置
    error_file: '/var/log/pm2/polylastchance-error.log',
    out_file: '/var/log/pm2/polylastchance-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 自动重启配置
    autorestart: true,
    watch: false, // 生产环境建议关闭 watch
    max_memory_restart: '1G', // 内存超过 1GB 自动重启
    
    // 其他配置
    min_uptime: '10s', // 最小运行时间
    max_restarts: 10, // 最大重启次数
    restart_delay: 4000, // 重启延迟（毫秒）
  }]
};

