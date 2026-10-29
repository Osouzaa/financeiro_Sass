BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[UserCpfs] (
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [Cpf] CHAR(11) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [UserCpfs_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UserCpfs_pkey] PRIMARY KEY CLUSTERED ([UserId]),
    CONSTRAINT [UQ_UserCpfs_Cpf] UNIQUE NONCLUSTERED ([Cpf])
);

-- CreateTable
CREATE TABLE [dbo].[PasswordResetTokens] (
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [TokenHash] CHAR(64) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [UsedAt] DATETIME2,
    [RequestIp] VARCHAR(45),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [PasswordResetTokens_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PasswordResetTokens_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_PasswordResetTokens_TokenHash] UNIQUE NONCLUSTERED ([TokenHash])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_PasswordResetTokens_UserId] ON [dbo].[PasswordResetTokens]([UserId]);

-- AddForeignKey
ALTER TABLE [dbo].[UserCpfs] ADD CONSTRAINT [FK_UserCpfs_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PasswordResetTokens] ADD CONSTRAINT [FK_PasswordResetTokens_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
