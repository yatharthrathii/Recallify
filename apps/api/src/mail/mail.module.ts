import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Global for the same reason PrismaModule is: one provider, no boundary worth
// drawing around it.
@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
