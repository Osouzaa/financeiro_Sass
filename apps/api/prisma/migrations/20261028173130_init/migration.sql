BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Users] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [Name] NVARCHAR(100) NOT NULL,
    [Email] NVARCHAR(254) NOT NULL,
    [PasswordHash] NVARCHAR(100) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Users_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Users_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_Users_Email] UNIQUE NONCLUSTERED ([Email])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshTokens] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [TokenHash] CHAR(64) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [RevokedAt] DATETIME2,
    [ReplacedBy] UNIQUEIDENTIFIER,
    [UserAgent] NVARCHAR(300),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [RefreshTokens_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshTokens_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_RefreshTokens_TokenHash] UNIQUE NONCLUSTERED ([TokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Accounts] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [Name] NVARCHAR(80) NOT NULL,
    [Type] VARCHAR(20) NOT NULL,
    [InitialBalance] DECIMAL(19,2) NOT NULL CONSTRAINT [Accounts_InitialBalance_df] DEFAULT 0,
    [InitialBalanceDate] DATE NOT NULL,
    [Color] VARCHAR(9),
    [ClosingDay] TINYINT,
    [DueDay] TINYINT,
    [CreditLimit] DECIMAL(19,2),
    [PaymentAccountId] UNIQUEIDENTIFIER,
    [Archived] BIT NOT NULL CONSTRAINT [Accounts_Archived_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Accounts_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Accounts_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Categories] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [Name] NVARCHAR(60) NOT NULL,
    [Type] VARCHAR(10) NOT NULL,
    [ParentId] UNIQUEIDENTIFIER,
    [Color] VARCHAR(9),
    [Icon] VARCHAR(40),
    [Archived] BIT NOT NULL CONSTRAINT [Categories_Archived_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Categories_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Categories_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Invoices] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [AccountId] UNIQUEIDENTIFIER NOT NULL,
    [ReferenceMonth] CHAR(7) NOT NULL,
    [ClosingDate] DATE NOT NULL,
    [DueDate] DATE NOT NULL,
    [Status] VARCHAR(20) NOT NULL CONSTRAINT [Invoices_Status_df] DEFAULT 'OPEN',
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Invoices_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Invoices_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_Invoices_Account_Month] UNIQUE NONCLUSTERED ([AccountId],[ReferenceMonth])
);

-- CreateTable
CREATE TABLE [dbo].[Transactions] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [AccountId] UNIQUEIDENTIFIER NOT NULL,
    [CategoryId] UNIQUEIDENTIFIER,
    [Type] VARCHAR(10) NOT NULL,
    [Amount] DECIMAL(19,2) NOT NULL,
    [Description] NVARCHAR(200) NOT NULL,
    [Notes] NVARCHAR(1000),
    [CompetenceDate] DATE NOT NULL,
    [CashDate] DATE,
    [Status] VARCHAR(10) NOT NULL,
    [InvoiceId] UNIQUEIDENTIFIER,
    [TransferGroupId] UNIQUEIDENTIFIER,
    [RecurrenceId] UNIQUEIDENTIFIER,
    [OriginalDate] DATE,
    [Detached] BIT NOT NULL CONSTRAINT [Transactions_Detached_df] DEFAULT 0,
    [InstallmentGroupId] UNIQUEIDENTIFIER,
    [InstallmentNumber] SMALLINT,
    [InstallmentTotal] SMALLINT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Transactions_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Transactions_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Recurrences] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [AccountId] UNIQUEIDENTIFIER NOT NULL,
    [CategoryId] UNIQUEIDENTIFIER,
    [Type] VARCHAR(10) NOT NULL,
    [Amount] DECIMAL(19,2) NOT NULL,
    [Description] NVARCHAR(200) NOT NULL,
    [Frequency] VARCHAR(10) NOT NULL,
    [Day] TINYINT NOT NULL,
    [StartDate] DATE NOT NULL,
    [EndDate] DATE,
    [GeneratedUntil] DATE,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Recurrences_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Recurrences_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Budgets] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [CategoryId] UNIQUEIDENTIFIER NOT NULL,
    [Month] CHAR(7) NOT NULL,
    [LimitAmount] DECIMAL(19,2) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Budgets_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Budgets_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_Budgets_User_Category_Month] UNIQUE NONCLUSTERED ([UserId],[CategoryId],[Month])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RefreshTokens_UserId] ON [dbo].[RefreshTokens]([UserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Accounts_UserId] ON [dbo].[Accounts]([UserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Categories_UserId_Type] ON [dbo].[Categories]([UserId], [Type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Invoices_UserId_DueDate] ON [dbo].[Invoices]([UserId], [DueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Transactions_UserId_CashDate] ON [dbo].[Transactions]([UserId], [CashDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Transactions_UserId_CompetenceDate] ON [dbo].[Transactions]([UserId], [CompetenceDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Transactions_InvoiceId] ON [dbo].[Transactions]([InvoiceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Transactions_RecurrenceId] ON [dbo].[Transactions]([RecurrenceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Transactions_TransferGroupId] ON [dbo].[Transactions]([TransferGroupId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Transactions_InstallmentGroupId] ON [dbo].[Transactions]([InstallmentGroupId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Recurrences_UserId] ON [dbo].[Recurrences]([UserId]);

-- AddForeignKey
ALTER TABLE [dbo].[RefreshTokens] ADD CONSTRAINT [FK_RefreshTokens_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Accounts] ADD CONSTRAINT [FK_Accounts_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Accounts] ADD CONSTRAINT [FK_Accounts_PaymentAccount] FOREIGN KEY ([PaymentAccountId]) REFERENCES [dbo].[Accounts]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Categories] ADD CONSTRAINT [FK_Categories_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Categories] ADD CONSTRAINT [FK_Categories_Parent] FOREIGN KEY ([ParentId]) REFERENCES [dbo].[Categories]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Invoices] ADD CONSTRAINT [FK_Invoices_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Invoices] ADD CONSTRAINT [FK_Invoices_Accounts] FOREIGN KEY ([AccountId]) REFERENCES [dbo].[Accounts]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Transactions] ADD CONSTRAINT [FK_Transactions_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Transactions] ADD CONSTRAINT [FK_Transactions_Accounts] FOREIGN KEY ([AccountId]) REFERENCES [dbo].[Accounts]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Transactions] ADD CONSTRAINT [FK_Transactions_Categories] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Transactions] ADD CONSTRAINT [FK_Transactions_Invoices] FOREIGN KEY ([InvoiceId]) REFERENCES [dbo].[Invoices]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Transactions] ADD CONSTRAINT [FK_Transactions_Recurrences] FOREIGN KEY ([RecurrenceId]) REFERENCES [dbo].[Recurrences]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Recurrences] ADD CONSTRAINT [FK_Recurrences_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Recurrences] ADD CONSTRAINT [FK_Recurrences_Accounts] FOREIGN KEY ([AccountId]) REFERENCES [dbo].[Accounts]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Recurrences] ADD CONSTRAINT [FK_Recurrences_Categories] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Budgets] ADD CONSTRAINT [FK_Budgets_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Budgets] ADD CONSTRAINT [FK_Budgets_Categories] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
