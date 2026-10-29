import { LayoutDashboard, Package, Sparkles, Users, FileText, Tags, ListTree, Boxes, Target, CalendarDays, Image, PanelsTopLeft, ShieldCheck } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type NavSubItem = {
  title: string;
  url: string;
};

type NavItem = {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  url?: string;
  items: NavSubItem[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_DATA: NavSection[] = [
  {
    label: "OPERACAO",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
        items: [],
      },
      {
        title: "Produtos",
        url: "/produtos",
        icon: Package,
        items: [],
      },
      {
        title: "Descrições com IA",
        url: "/produtos/gerar-descricoes",
        icon: Sparkles,
        items: [],
      },
      {
        title: "Clientes",
        url: "/clientes",
        icon: Users,
        items: [],
      },
      {
        title: "Orçamentos",
        url: "/orcamentos",
        icon: FileText,
        items: [],
      },
    ],
  },
  {
    label: "CATALOGO",
    items: [
      {
        title: "Categorias",
        url: "/categorias",
        icon: Tags,
        items: [],
      },
      {
        title: "Subcategorias",
        url: "/subcategorias",
        icon: ListTree,
        items: [],
      },
      {
        title: "Subcategorias por produto",
        url: "/produtos/subcategorias",
        icon: Boxes,
        items: [],
      },
      {
        title: "Publicos-alvo",
        url: "/publicos-alvos",
        icon: Target,
        items: [],
      },
      {
        title: "Datas promocionais",
        url: "/datas-promocionais",
        icon: CalendarDays,
        items: [],
      },
      {
        title: "Banners",
        url: "/banners",
        icon: Image,
        items: [],
      },
      {
        title: "Landing pages",
        url: "/landing-pages",
        icon: PanelsTopLeft,
        items: [],
      },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      {
        title: "Usuarios",
        url: "/usuarios",
        icon: Users,
        items: [],
      },
      {
        title: "Permissoes",
        url: "/permissoes",
        icon: ShieldCheck,
        items: [],
      },
    ],
  },
];
