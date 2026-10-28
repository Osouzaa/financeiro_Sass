BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Transactions] ADD [TransferDirection] VARCHAR(3);

-- AlterTable
ALTER TABLE [dbo].[Users] ADD [AlertBudget] BIT NOT NULL CONSTRAINT [Users_AlertBudget_df] DEFAULT 1,
[AlertBudgetPercent] TINYINT NOT NULL CONSTRAINT [Users_AlertBudgetPercent_df] DEFAULT 80,
[AlertDueDays] TINYINT NOT NULL CONSTRAINT [Users_AlertDueDays_df] DEFAULT 3,
[AlertDueSoon] BIT NOT NULL CONSTRAINT [Users_AlertDueSoon_df] DEFAULT 1,
[AlertNegativeBalance] BIT NOT NULL CONSTRAINT [Users_AlertNegativeBalance_df] DEFAULT 1,
[AvatarData] VARBINARY(max),
[AvatarMimeType] VARCHAR(20),
[AvatarUpdatedAt] DATETIME2;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
