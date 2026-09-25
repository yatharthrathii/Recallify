import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DemoModule } from '../demo/demo.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

// Secrets are passed per call rather than configured here, so the access and
// refresh secrets can never be confused for one another.
@Module({
  imports: [JwtModule.register({}), DemoModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  exports: [TokenService],
})
export class AuthModule {}
