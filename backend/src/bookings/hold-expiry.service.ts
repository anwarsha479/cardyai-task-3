import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Clock, CLOCK } from '../common/clock/clock';
import { EnvironmentVariables } from '../config/env.validation';
import { SeatUpdatesService } from '../seat-updates/seat-updates.service';
import { releaseExpiredHolds } from './seat-claims';

/**
 * Marks expired holds as expired and tells the seat maps. Seats are already free from the expiry
 * instant on every read and every new hold; this job makes the stored state and the live maps catch up.
 */
@Injectable()
export class HoldExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpiryService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly updates: SeatUpdatesService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onModuleInit(): void {
    const seconds = this.config.get('HOLD_SWEEP_INTERVAL_SECONDS', { infer: true });
    if (seconds > 0) {
      this.timer = setInterval(() => void this.tick(), seconds * 1000);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Returns the ids of the events whose holds were released. */
  async releaseExpired(): Promise<string[]> {
    const now = this.clock.now();
    const eventIds = await this.dataSource.transaction((manager) => releaseExpiredHolds(manager, now));
    this.updates.publish(...eventIds);
    return eventIds;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.releaseExpired();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
