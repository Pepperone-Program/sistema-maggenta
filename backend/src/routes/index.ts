import { Router } from 'express';
import produtosRoutes from './produtos';
import orcamentosRoutes from './orcamentos';
import usuariosRoutes from './usuarios';
import categoriasRoutes from './categorias';
import subcategoriasRoutes from './subcategorias';
import gruposRoutes from './grupos';
import publicosAlvosRoutes from './publicos-alvos';
import datasPromocionaisRoutes from './datas-promocionais';
import estatisticasProdutosRoutes from './estatisticas-produtos';
import clientesRoutes from './clientes';
import bannersRoutes from './banners';

const router = Router();

router.use('/api/v1/produtos', produtosRoutes);
router.use('/api/v1/orcamentos', orcamentosRoutes);
router.use('/api/v1/usuarios', usuariosRoutes);
router.use('/api/v1/categorias', categoriasRoutes);
router.use('/api/v1/subcategorias', subcategoriasRoutes);
router.use('/api/v1/grupos', gruposRoutes);
router.use('/api/v1/publicos-alvos', publicosAlvosRoutes);
router.use('/api/v1/datas-promocionais', datasPromocionaisRoutes);
router.use('/api/v1/estatisticas-produtos', estatisticasProdutosRoutes);
router.use('/api/v1/clientes', clientesRoutes);
router.use('/api/v1/banners', bannersRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
