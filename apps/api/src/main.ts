import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfig);

  // Atrás de proxy, o IP real vem no X-Forwarded-For; sem isso, o limite por IP pegaria o do proxy
  if (config.trustProxy) app.set('trust proxy', 1);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.enableShutdownHooks();

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Financeiro API')
        .setDescription('Controle financeiro pessoal')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(config.port);
  Logger.log(`API em http://localhost:${config.port}/api/v1`, 'Bootstrap');
  if (!config.isProduction)
    Logger.log(`Swagger em http://localhost:${config.port}/docs`, 'Bootstrap');
}

void bootstrap();
