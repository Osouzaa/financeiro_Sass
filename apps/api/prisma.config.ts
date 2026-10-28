import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Formato: sqlserver://HOST:PORTA;database=NOME;user=USUARIO;password=SENHA;encrypt=true;trustServerCertificate=true
    // Sem fallback obrigatório: `prisma generate` (rodado no install) não precisa do banco.
    // Comandos que conectam (migrate, studio) falham com mensagem clara se faltar.
    url: process.env.DATABASE_URL ?? '',
    // Banco auxiliar que o `prisma migrate dev` usa para detectar divergências
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
