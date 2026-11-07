import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1762500000400 implements MigrationInterface {
  name = 'CreateBookings1762500000400';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE booking_status AS ENUM ('held', 'confirmed', 'expired', 'cancelled')`);
    await queryRunner.query(`
      CREATE TABLE bookings (
        id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id        uuid           NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
        attendee_id     uuid           NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        status          booking_status NOT NULL,
        hold_expires_at timestamptz    NOT NULL,
        confirmed_at    timestamptz    NULL,
        cancelled_at    timestamptz    NULL,
        created_at      timestamptz    NOT NULL DEFAULT now(),
        updated_at      timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT uq_bookings_id_event UNIQUE (id, event_id),
        CONSTRAINT ck_bookings_confirmed_at CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL),
        CONSTRAINT ck_bookings_cancelled_at CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_bookings_one_active_hold ON bookings (event_id, attendee_id) WHERE status = 'held'`,
    );
    await queryRunner.query(`CREATE INDEX ix_bookings_attendee ON bookings (attendee_id, created_at)`);
    await queryRunner.query(`CREATE INDEX ix_bookings_held_expiry ON bookings (hold_expires_at) WHERE status = 'held'`);

    await queryRunner.query(`
      CREATE TABLE booking_seats (
        booking_id  uuid        NOT NULL,
        event_id    uuid        NOT NULL,
        seat_row    smallint    NOT NULL,
        seat_number smallint    NOT NULL,
        released_at timestamptz NULL,
        CONSTRAINT pk_booking_seats PRIMARY KEY (booking_id, seat_row, seat_number),
        CONSTRAINT fk_booking_seats_booking FOREIGN KEY (booking_id, event_id)
          REFERENCES bookings (id, event_id) ON DELETE CASCADE,
        CONSTRAINT ck_booking_seats_row CHECK (seat_row >= 1),
        CONSTRAINT ck_booking_seats_number CHECK (seat_number >= 1)
      )`);
    // The double-booking guarantee (FR-07): at most one unreleased claim per seat, whoever writes it.
    await queryRunner.query(`
      CREATE UNIQUE INDEX ux_booking_seats_active_seat
        ON booking_seats (event_id, seat_row, seat_number) WHERE released_at IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE booking_seats`);
    await queryRunner.query(`DROP TABLE bookings`);
    await queryRunner.query(`DROP TYPE booking_status`);
  }
}
