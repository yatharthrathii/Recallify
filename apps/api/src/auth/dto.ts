import {
  authTokens,
  currentUser,
  loginRequest,
  registerRequest,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * Thin wrappers so Nest and Swagger can see the contracts.
 *
 * The schemas themselves live in @recallify/contracts and are shared with the
 * web and mobile clients. Nothing is redefined here -- these classes exist
 * only because decorators need a class to point at.
 */
export class RegisterDto extends createZodDto(registerRequest) {}
export class LoginDto extends createZodDto(loginRequest) {}
export class AuthTokensDto extends createZodDto(authTokens) {}
export class CurrentUserDto extends createZodDto(currentUser) {}
