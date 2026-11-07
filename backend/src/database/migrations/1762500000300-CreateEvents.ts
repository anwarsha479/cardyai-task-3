import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvents1762500000300 implements MigrationInterface {
  name = 'CreateEvents1762500000300';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE events (
        id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        name          varchar(120)  NOT NULL,
        description   varchar(2000) NULL,
        venue         varchar(120)  NOT NULL,
        starts_at     timestamptz   NOT NULL,
        seat_rows     smallint      NOT NULL,
        seats_per_row smallint      NOT NULL,
        created_by    uuid          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        created_at    timestamptz   NOT NULL DEFAULT now(),
        updated_at    timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT ck_events_name CHECK (length(btrim(name)) > 0),
        CONSTRAINT ck_events_venue CHECK (length(btrim(venue)) > 0),
        CONSTRAINT ck_events_seat_rows CHECK (seat_rows BETWEEN 1 AND 26),
        CONSTRAINT ck_events_seats_per_row CHECK (seats_per_row BETWEEN 1 AND 50)
      )`);
    await queryRunner.query(`CREATE INDEX ix_events_starts_at ON events (starts_at)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE events`);
  }
}
