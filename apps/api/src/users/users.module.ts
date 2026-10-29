import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountDataService } from './account-data.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, AccountDataService],
})
export class UsersModule {}
