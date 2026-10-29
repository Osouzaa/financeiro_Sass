BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Users] ADD [EmailVerifiedAt] DATETIME2,
[Role] VARCHAR(20) NOT NULL CONSTRAINT [Users_Role_df] DEFAULT 'USER',
[Status] VARCHAR(20) NOT NULL CONSTRAINT [Users_Status_df] DEFAULT 'ACTIVE',
[TermsAcceptedAt] DATETIME2,
[TermsVersion] VARCHAR(20);

-- CreateTable
CREATE TABLE [dbo].[UserPhones] (
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [Phone] VARCHAR(16) NOT NULL,
    [WhatsappOptIn] BIT NOT NULL CONSTRAINT [UserPhones_WhatsappOptIn_df] DEFAULT 0,
    [OptInAt] DATETIME2,
    [VerifiedAt] DATETIME2,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [UserPhones_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UserPhones_pkey] PRIMARY KEY CLUSTERED ([UserId]),
    CONSTRAINT [UQ_UserPhones_Phone] UNIQUE NONCLUSTERED ([Phone])
);

-- CreateTable
CREATE TABLE [dbo].[EmailVerificationTokens] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [TokenHash] CHAR(64) NOT NULL,
    [Email] NVARCHAR(254) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [UsedAt] DATETIME2,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [EmailVerificationTokens_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EmailVerificationTokens_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_EmailVerificationTokens_TokenHash] UNIQUE NONCLUSTERED ([TokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Plans] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [Code] VARCHAR(30) NOT NULL,
    [Name] NVARCHAR(40) NOT NULL,
    [Description] NVARCHAR(200) NOT NULL CONSTRAINT [Plans_Description_df] DEFAULT '',
    [PriceAmount] DECIMAL(19,2) NOT NULL CONSTRAINT [Plans_PriceAmount_df] DEFAULT 0,
    [Interval] VARCHAR(10) NOT NULL CONSTRAINT [Plans_Interval_df] DEFAULT 'MONTH',
    [IsPublic] BIT NOT NULL CONSTRAINT [Plans_IsPublic_df] DEFAULT 1,
    [IsActive] BIT NOT NULL CONSTRAINT [Plans_IsActive_df] DEFAULT 1,
    [Highlighted] BIT NOT NULL CONSTRAINT [Plans_Highlighted_df] DEFAULT 0,
    [SortOrder] INT NOT NULL CONSTRAINT [Plans_SortOrder_df] DEFAULT 0,
    [Features] NVARCHAR(2000) NOT NULL CONSTRAINT [Plans_Features_df] DEFAULT '[]',
    [MaxAccounts] INT,
    [MaxCards] INT,
    [MaxRecurrences] INT,
    [MaxBudgets] INT,
    [ProjectionDays] INT NOT NULL CONSTRAINT [Plans_ProjectionDays_df] DEFAULT 30,
    [Whatsapp] BIT NOT NULL CONSTRAINT [Plans_Whatsapp_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Plans_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Plans_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_Plans_Code] UNIQUE NONCLUSTERED ([Code])
);

-- CreateTable
CREATE TABLE [dbo].[Subscriptions] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [PlanId] UNIQUEIDENTIFIER NOT NULL,
    [Status] VARCHAR(20) NOT NULL,
    [CurrentPeriodEnd] DATE,
    [Provider] VARCHAR(20) NOT NULL CONSTRAINT [Subscriptions_Provider_df] DEFAULT 'MANUAL',
    [ProviderRef] VARCHAR(100),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Subscriptions_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Subscriptions_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_Subscriptions_UserId] UNIQUE NONCLUSTERED ([UserId])
);

-- CreateTable
CREATE TABLE [dbo].[AdminAuditLogs] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [ActorId] UNIQUEIDENTIFIER,
    [Action] VARCHAR(50) NOT NULL,
    [TargetType] VARCHAR(30) NOT NULL,
    [TargetId] VARCHAR(64),
    [Details] NVARCHAR(2000),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [AdminAuditLogs_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AdminAuditLogs_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_EmailVerificationTokens_UserId] ON [dbo].[EmailVerificationTokens]([UserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Subscriptions_PlanId] ON [dbo].[Subscriptions]([PlanId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AdminAuditLogs_CreatedAt] ON [dbo].[AdminAuditLogs]([CreatedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[UserPhones] ADD CONSTRAINT [FK_UserPhones_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmailVerificationTokens] ADD CONSTRAINT [FK_EmailVerificationTokens_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Subscriptions] ADD CONSTRAINT [FK_Subscriptions_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Subscriptions] ADD CONSTRAINT [FK_Subscriptions_Plans] FOREIGN KEY ([PlanId]) REFERENCES [dbo].[Plans]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AdminAuditLogs] ADD CONSTRAINT [FK_AdminAuditLogs_Users] FOREIGN KEY ([ActorId]) REFERENCES [dbo].[Users]([Id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Planos iniciais (o super administrador ajusta preços e limites pelo painel).
-- Família fica fora da vitrine até o compartilhamento entre pessoas existir.
INSERT INTO [dbo].[Plans] ([Id], [Code], [Name], [Description], [PriceAmount], [Interval], [IsPublic], [IsActive], [Highlighted], [SortOrder], [Features], [MaxAccounts], [MaxCards], [MaxRecurrences], [MaxBudgets], [ProjectionDays], [Whatsapp], [UpdatedAt])
VALUES
  (NEWID(), 'free', N'Grátis', N'Para organizar o básico e conhecer o sistema.', 0, 'MONTH', 1, 1, 0, 1,
   N'["2 contas e 1 cartão de crédito","Lançamentos ilimitados","Até 5 recorrências","Orçamento em até 3 categorias","Projeção de saldo de 30 dias"]',
   2, 1, 5, 3, 30, 0, CURRENT_TIMESTAMP),
  (NEWID(), 'pro', N'Pro', N'Tudo liberado para controlar a vida financeira inteira.', 14.90, 'MONTH', 1, 1, 1, 2,
   N'["Contas e cartões ilimitados","Recorrências e orçamento sem limite","Projeção de saldo de 1 ano","Assistente no WhatsApp (em breve)","Suporte prioritário"]',
   NULL, NULL, NULL, NULL, 365, 1, CURRENT_TIMESTAMP),
  (NEWID(), 'family', N'Família', N'O Pro para a casa toda, com finanças compartilhadas.', 24.90, 'MONTH', 0, 1, 0, 3,
   N'["Tudo do Pro","Até 5 pessoas compartilhando (em breve)","Orçamento da casa","Assistente no WhatsApp para todos (em breve)"]',
   NULL, NULL, NULL, NULL, 365, 1, CURRENT_TIMESTAMP);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
