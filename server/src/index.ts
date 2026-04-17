import app from './app.js';
import config from './config/env.js';
import { prisma } from '../prisma/lib.js';

const server = app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
  console.log(`📚 Environment: ${config.nodeEnv}`);
  console.log(`🔗 CORS origin: ${config.frontendUrl}`);
});

const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
