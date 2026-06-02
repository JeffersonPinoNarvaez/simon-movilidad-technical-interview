import type { IVehicleRepository } from '@fleet-portal/domain';

export class ListVehiclesUseCase {
  constructor(private readonly vehicleRepo: IVehicleRepository) {}

  async execute() {
    const vehicles = await this.vehicleRepo.findAll();
    return vehicles.map((v) => v.toJSON());
  }
}
