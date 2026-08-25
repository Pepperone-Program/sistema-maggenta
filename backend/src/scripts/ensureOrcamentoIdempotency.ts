import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { OrcamentoModel } from '@models/Orcamento';

const run = async (): Promise<void> => {
  await OrcamentoModel.ensureIdempotencyInfrastructure();
  console.log('orcamentos_idempotencia: estrutura criada e acesso validado');
};

run().then(
  async () => {
    await closeDatabasePool();
  },
  async (error) => {
    console.error('orcamentos_idempotencia: falha na preparacao', error);
    await closeDatabasePool().catch(() => undefined);
    process.exitCode = 1;
  }
);
