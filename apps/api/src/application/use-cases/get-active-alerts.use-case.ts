import type { IAlertRepository } from '@fleet-portal/domain';
import type { AlertType } from '@fleet-portal/domain';

export class GetActiveAlertsUseCase {
  constructor(private readonly alertRepo: IAlertRepository) {}

  async execute(type: AlertType | 'all' = 'all') {
    const alerts = await this.alertRepo.findActive(type);
    return alerts.map((a) => a.toJSON());
  }
}
