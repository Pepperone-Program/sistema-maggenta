import { ClienteContatoModel, ClienteModel } from '@models/Cliente';
import { OrcamentoModel } from '@models/Orcamento';
import type {
  Cliente,
  ClienteContato,
  CreateClienteContatoDTO,
  CreateClienteDTO,
  UpdateClienteContatoDTO,
  UpdateClienteDTO,
} from '@/types/cliente';
import { throwError } from '@utils/helpers';

export class ClienteService {
  static async createCliente(empresaId: number, data: CreateClienteDTO): Promise<Cliente> {
    if (data.id_cliente !== undefined) {
      const existentePorId = await ClienteModel.findById(empresaId, data.id_cliente);
      if (existentePorId) {
        throwError('DUPLICATE_CLIENTE_ID', 'Cliente com esse ID ja existe', 409);
      }
    }

    if (data.cnpj_cpf) {
      const existente = await ClienteModel.findByDocumento(empresaId, data.cnpj_cpf);
      if (existente) {
        throwError('DUPLICATE_CLIENTE_DOCUMENTO', 'Cliente com esse documento ja existe', 409);
      }
    }

    const id = await ClienteModel.create(empresaId, data);
    const cliente = await ClienteModel.findById(empresaId, id);

    if (!cliente) {
      throwError('CREATE_FAILED', 'Falha ao criar cliente', 500);
    }

    return cliente as Cliente;
  }

  static async getClienteById(empresaId: number, clienteId: number): Promise<Cliente> {
    const cliente = await ClienteModel.findById(empresaId, clienteId);

    if (!cliente) {
      throwError('CLIENTE_NOT_FOUND', 'Cliente nao encontrado', 404);
    }

    return cliente as Cliente;
  }

  static async listClientes(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    habilitado?: string
  ): Promise<{ items: Cliente[]; total: number; page: number; limit: number }> {
    const { items, total } = await ClienteModel.findAll(
      empresaId,
      page,
      limit,
      search,
      habilitado
    );

    return { items, total, page, limit };
  }

  static async updateCliente(
    empresaId: number,
    clienteId: number,
    data: UpdateClienteDTO
  ): Promise<Cliente> {
    const cliente = await this.getClienteById(empresaId, clienteId);

    if (data.cnpj_cpf && data.cnpj_cpf !== cliente.cnpj_cpf) {
      const existente = await ClienteModel.findByDocumento(empresaId, data.cnpj_cpf);
      if (existente && existente.id_cliente !== clienteId) {
        throwError('DUPLICATE_CLIENTE_DOCUMENTO', 'Cliente com esse documento ja existe', 409);
      }
    }

    await ClienteModel.update(empresaId, clienteId, data);
    const updated = await ClienteModel.findById(empresaId, clienteId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar cliente', 500);
    }

    return updated as Cliente;
  }

  static async deleteCliente(empresaId: number, clienteId: number): Promise<void> {
    await this.getClienteById(empresaId, clienteId);
    await ClienteContatoModel.deleteByCliente(empresaId, clienteId);

    const success = await ClienteModel.delete(empresaId, clienteId);
    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar cliente', 500);
    }
  }

  static async createContato(
    empresaId: number,
    clienteId: number,
    data: CreateClienteContatoDTO
  ): Promise<ClienteContato> {
    await this.getClienteById(empresaId, clienteId);
    const existente = await ClienteContatoModel.findByEmail(
      empresaId,
      clienteId,
      data.contato_email
    );

    if (existente) {
      throwError('DUPLICATE_CLIENTE_CONTATO', 'Contato com esse email ja existe', 409);
    }

    return ClienteContatoModel.create(empresaId, clienteId, data);
  }

  static async getContatoByEmail(
    empresaId: number,
    clienteId: number,
    contatoEmail: string
  ): Promise<ClienteContato> {
    await this.getClienteById(empresaId, clienteId);
    const contato = await ClienteContatoModel.findByEmail(empresaId, clienteId, contatoEmail);

    if (!contato) {
      throwError('CLIENTE_CONTATO_NOT_FOUND', 'Contato do cliente nao encontrado', 404);
    }

    return contato as ClienteContato;
  }

  static async listContatos(
    empresaId: number,
    clienteId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    habilitado?: string
  ): Promise<{ items: ClienteContato[]; total: number; page: number; limit: number }> {
    await this.getClienteById(empresaId, clienteId);
    const { items, total } = await ClienteContatoModel.findAll(
      empresaId,
      clienteId,
      page,
      limit,
      search,
      habilitado
    );

    return { items, total, page, limit };
  }

  static async updateContato(
    empresaId: number,
    clienteId: number,
    contatoEmail: string,
    data: UpdateClienteContatoDTO
  ): Promise<ClienteContato> {
    await this.getContatoByEmail(empresaId, clienteId, contatoEmail);

    if (data.contato_email && data.contato_email !== contatoEmail) {
      const existente = await ClienteContatoModel.findByEmail(
        empresaId,
        clienteId,
        data.contato_email
      );
      if (existente) {
        throwError('DUPLICATE_CLIENTE_CONTATO', 'Contato com esse email ja existe', 409);
      }
    }

    await ClienteContatoModel.update(empresaId, clienteId, contatoEmail, data);
    const updated = await ClienteContatoModel.findByEmail(
      empresaId,
      clienteId,
      data.contato_email || contatoEmail
    );

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar contato do cliente', 500);
    }

    return updated as ClienteContato;
  }

  static async deleteContato(
    empresaId: number,
    clienteId: number,
    contatoEmail: string
  ): Promise<void> {
    await this.getContatoByEmail(empresaId, clienteId, contatoEmail);
    const success = await ClienteContatoModel.delete(empresaId, clienteId, contatoEmail);

    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar contato do cliente', 500);
    }
  }

  static async listOrcamentos(
    empresaId: number,
    clienteId: number,
    page: number = 1,
    limit: number = 50
  ) {
    await this.getClienteById(empresaId, clienteId);
    const { items, total } = await OrcamentoModel.findByCliente(empresaId, clienteId, page, limit);

    return { items, total, page, limit };
  }
}
