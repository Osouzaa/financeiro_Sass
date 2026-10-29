BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Plans] ADD [TrialDays] INT NOT NULL CONSTRAINT [Plans_TrialDays_df] DEFAULT 0;

-- AlterTable
ALTER TABLE [dbo].[Subscriptions] ADD [CanceledAt] DATETIME2,
[TrialEndsAt] DATE;

-- AlterTable
ALTER TABLE [dbo].[Users] ADD [TrialUsedAt] DATETIME2;

-- CreateTable
CREATE TABLE [dbo].[CheckoutSessions] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [PlanId] UNIQUEIDENTIFIER NOT NULL,
    [Status] VARCHAR(20) NOT NULL CONSTRAINT [CheckoutSessions_Status_df] DEFAULT 'PENDING',
    [TrialDays] INT NOT NULL CONSTRAINT [CheckoutSessions_TrialDays_df] DEFAULT 0,
    [Amount] DECIMAL(19,2) NOT NULL,
    [ProviderRef] VARCHAR(100),
    [InitPoint] NVARCHAR(500),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [CheckoutSessions_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CheckoutSessions_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_CheckoutSessions_ProviderRef] UNIQUE NONCLUSTERED ([ProviderRef])
);

-- CreateTable
CREATE TABLE [dbo].[Payments] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER,
    [Provider] VARCHAR(20) NOT NULL,
    [ProviderPaymentId] VARCHAR(100) NOT NULL,
    [ProviderRef] VARCHAR(100),
    [Amount] DECIMAL(19,2) NOT NULL,
    [Status] VARCHAR(20) NOT NULL,
    [Description] NVARCHAR(200) NOT NULL,
    [PayerEmail] NVARCHAR(254),
    [PaidAt] DATETIME2,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Payments_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Payments_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_Payments_ProviderPaymentId] UNIQUE NONCLUSTERED ([ProviderPaymentId])
);

-- CreateTable
CREATE TABLE [dbo].[WebhookEvents] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [Provider] VARCHAR(20) NOT NULL,
    [RequestId] VARCHAR(100),
    [Type] VARCHAR(60) NOT NULL,
    [ResourceId] VARCHAR(100),
    [Status] VARCHAR(20) NOT NULL,
    [Error] NVARCHAR(1000),
    [ProcessedAt] DATETIME2,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [WebhookEvents_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [WebhookEvents_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_WebhookEvents_RequestId] UNIQUE NONCLUSTERED ([RequestId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_CheckoutSessions_UserId] ON [dbo].[CheckoutSessions]([UserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Payments_UserId] ON [dbo].[Payments]([UserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Payments_CreatedAt] ON [dbo].[Payments]([CreatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_WebhookEvents_CreatedAt] ON [dbo].[WebhookEvents]([CreatedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[CheckoutSessions] ADD CONSTRAINT [FK_CheckoutSessions_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckoutSessions] ADD CONSTRAINT [FK_CheckoutSessions_Plans] FOREIGN KEY ([PlanId]) REFERENCES [dbo].[Plans]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payments] ADD CONSTRAINT [FK_Payments_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Pro com 7 dias grátis na primeira assinatura (editável no painel).
-- EXEC: o SQL Server compila o lote antes de criar a coluna; assim o UPDATE só é compilado ao rodar.
EXEC('UPDATE [dbo].[Plans] SET [TrialDays] = 7 WHERE [Code] = ''pro''');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
