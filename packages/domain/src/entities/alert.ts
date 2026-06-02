import { VehicleId } from '../value-objects/ids.js';

export type AlertType = 'stopped' | 'speeding' | 'fuel' | 'offline' | 'critical_zone';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertProps {
  id: string;
  vehicleId: VehicleId;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  active: boolean;
  createdAt: Date;
  resolvedAt: Date | null;
}

export class Alert {
  private constructor(private readonly props: AlertProps) {}

  static create(props: AlertProps): Alert {
    return new Alert(props);
  }

  get id(): string {
    return this.props.id;
  }

  get vehicleId(): VehicleId {
    return this.props.vehicleId;
  }

  get type(): AlertType {
    return this.props.type;
  }

  get message(): string {
    return this.props.message;
  }

  get severity(): AlertSeverity {
    return this.props.severity;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get resolvedAt(): Date | null {
    return this.props.resolvedAt;
  }

  resolve(): Alert {
    return Alert.create({
      ...this.props,
      active: false,
      resolvedAt: new Date(),
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      vehicleId: this.props.vehicleId.toString(),
      type: this.props.type,
      message: this.props.message,
      severity: this.props.severity,
      active: this.props.active,
      createdAt: this.props.createdAt.toISOString(),
      resolvedAt: this.props.resolvedAt?.toISOString() ?? null,
    };
  }
}
