import { DiscoveryModule, DiscoveryService } from '@golevelup/nestjs-discovery';
import { DynamicModule, Global, Module, Provider } from '@nestjs/common';

import { SqsMetadataScanner } from './sqs-metadata.scanner';
import { SqsConfig } from './sqs.config';
import { SqsAsyncConfig } from './sqs.interfaces';
import { SqsService } from './sqs.service';
import { SqsStorage } from './sqs.storage';
import { SqsQueueAsyncOptions, SqsQueueOptions } from './sqs.types';

@Global()
@Module({})
export class SqsModule {
  public static forRootAsync(asyncSqsConfig: SqsAsyncConfig): DynamicModule {
    const imports = this.getUniqImports([asyncSqsConfig]);

    const SqsMetadatScanner: Provider = {
      provide: SqsMetadataScanner,
      useFactory: (discover: DiscoveryService) => {
        return new SqsMetadataScanner(discover);
      },
      inject: [DiscoveryService],
    };

    const SqsConfigProvider: Provider = {
      provide: SqsConfig,
      useFactory: asyncSqsConfig.useFactory,
      inject: asyncSqsConfig.inject || [],
    };

    return {
      global: true,
      module: SqsModule,
      imports: [...imports, DiscoveryModule],
      providers: [SqsMetadatScanner, SqsConfigProvider],
      exports: [SqsMetadatScanner, SqsConfigProvider],
    };
  }

  public static registerQueue(...options: SqsQueueOptions) {
    SqsStorage.addQueueOptions([].concat(options));
    const sqsService: Provider = {
      provide: SqsService,
      useFactory: async (scanner: SqsMetadataScanner, sqsConfig: SqsConfig) => {
        return new SqsService(scanner, sqsConfig);
      },
      inject: [SqsMetadataScanner, SqsConfig],
    };

    return {
      global: true,
      module: SqsModule,
      providers: [sqsService],
      exports: [sqsService],
    };
  }

  public static registerQueueAsync(...options: SqsQueueAsyncOptions) {
    const queueProviders = options.map((queueOptions) => ({
      provide: SqsService,
      useFactory: async (scanner: SqsMetadataScanner, sqsConfig: SqsConfig, ...factoryArgs: unknown[]) => {
        const createdOptions = await queueOptions.useFactory(...factoryArgs);

        SqsStorage.addQueueOptions([createdOptions]);

        return new SqsService(scanner, sqsConfig);
      },
      inject: [SqsMetadataScanner, SqsConfig, ...(queueOptions.inject || [])],
    }));

    return {
      global: true,
      module: SqsModule,
      providers: [...queueProviders],
      exports: [...queueProviders],
    };
  }

  private static getUniqImports(options: Array<SqsAsyncConfig>) {
    return (
      options
        .map((option) => option.imports)
        .reduce((acc, i) => acc.concat(i || []), [])
        .filter((v, i, a) => a.indexOf(v) === i) || []
    );
  }
}
