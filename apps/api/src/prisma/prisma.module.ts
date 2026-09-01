import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global because every feature module needs it and threading it through each
// imports array adds noise without adding a boundary.
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
