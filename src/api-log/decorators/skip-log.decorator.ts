import { SetMetadata } from '@nestjs/common';

export const SKIP_LOG_KEY = 'skip_log';

export const SkipLog = () => SetMetadata(SKIP_LOG_KEY, true);
