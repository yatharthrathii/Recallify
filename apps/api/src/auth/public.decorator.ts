import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'recallify:public';

/**
 * Opens a route to unauthenticated callers.
 *
 * The guard is global, so this is the only way through it. Making the opt-out
 * explicit means a new endpoint is private until someone deliberately says
 * otherwise.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
