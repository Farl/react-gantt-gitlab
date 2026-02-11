/**
 * Factory for creating data providers
 *
 * This factory abstracts provider instantiation and allows
 * adding new data source types without modifying UI code.
 */

import type {
  DataProviderInterface,
  DataProviderConfig,
} from './DataProviderInterface';

export class DataProviderFactory {
  /**
   * Create a data provider for the given configuration
   *
   * @param config - Provider configuration specifying type and connection details
   * @returns A DataProviderInterface instance
   * @throws Error if provider type is not supported
   */
  static create(config: DataProviderConfig): DataProviderInterface {
    switch (config.type) {
      case 'custom':
        throw new Error(
          'Custom data providers should be instantiated directly (e.g., new StaticDataProvider(...))',
        );

      default:
        throw new Error(
          `Unknown data provider type: ${(config as { type: string }).type}`,
        );
    }
  }
}
