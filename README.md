# Financeiro

Controle financeiro pessoal: contas, cartões, lançamentos, recorrências, orçamento e projeção de saldo.
As regras de negócio estão na especificação do MVP (documento "Especificação do MVP — Controle Financeiro Pessoal").

## Estrutura

```
apps/
  api/        NestJS 11 + Prisma 7 (SQL Server)
  web/        React 19 + Vite + TanStack Query + Tailwind 4
packages/
  shared/     Enums, schemas Zod e regras puras (fatura, parcelas, dinheiro, datas)
```

O pacote `shared` é usado pelos dois lados: o mesmo schema Zod valida o formulário no front e o corpo da requisição na API,
e regras como "em qual fatura cai esta compra" existem em um lugar só, com testes.

## Pré-requisitos

- Node.js 22 ou superior
- pnpm 10: `npm install -g pnpm` (ou `corepack enable`)
- Docker Desktop (para o SQL Server local)

## Primeira execução

```bash
# 1. Dependências (também gera o cliente Prisma)
pnpm install

# 2. Variáveis de ambiente
cp apps/api/.env.example apps/api/.env      # no PowerShell: Copy-Item apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Banco de dados
pnpm db:up                                  # sobe o SQL Server no Docker (aguarde ~30s na primeira vez)
pnpm db:migrate --name init                 # cria o banco Financeiro, a migration inicial e as tabelas

# 4. Rodar tudo
pnpm dev
```

- Front: http://localhost:5173
- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/docs
- Saúde da API e do banco: http://localhost:3000/api/v1/health

Crie uma conta na tela de cadastro. As categorias padrão são criadas automaticamente e aparecem em **Configurações**.

> Antes de usar de verdade, troque `JWT_ACCESS_SECRET` em `apps/api/.env` por um valor aleatório:
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## Comandos

| Comando                         | O que faz                                                |
| ------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                      | API e front em modo watch                                |
| `pnpm test`                     | Testes de todos os pacotes                               |
| `pnpm lint` / `pnpm typecheck`  | Qualidade e tipos                                        |
| `pnpm build`                    | Build de produção                                        |
| `pnpm format`                   | Formata o código com Prettier                            |
| `pnpm db:up` / `pnpm db:down`   | Liga/desliga o SQL Server                                |
| `pnpm db:migrate --name <nome>` | Cria e aplica uma migration após mudar o `schema.prisma` |
| `pnpm db:studio`                | Abre o Prisma Studio para ver os dados                   |

## Decisões técnicas

- **Dinheiro:** `DECIMAL(19,2)` no banco e centavos inteiros no código (`toCents`, `fromCents`, `formatBRL`).
- **Datas de calendário** (competência, vencimento) são `DATE` no banco e strings `YYYY-MM-DD` no código, para evitar erros de fuso.
- **Enums:** o SQL Server não tem enum; os valores ficam em `packages/shared/src/enums.ts` e são validados pela aplicação.
- **Multiusuário desde o início:** toda tabela tem `UserId`, e o id do usuário vem sempre do token, nunca do corpo da requisição.
- **Autenticação:** access token JWT de 15 minutos guardado só em memória no front; refresh token opaco em cookie `httpOnly`,
  com rotação a cada uso e revogação de todas as sessões se um token antigo for reutilizado.
- **Relações com `NoAction`:** o SQL Server rejeita múltiplos caminhos de exclusão em cascata; exclusões serão feitas pelos services.

## Próximos passos

1. Contas e cartões (CRUD + saldo calculado)
2. Lançamentos e transferências
3. Faturas de cartão (usa `invoiceForPurchase` do `shared`)
4. Parcelamentos (usa `splitInstallments`) e recorrências com edição "só esta / esta e as próximas"
5. Orçamento, dashboard e projeção de saldo
