import * as Icons from "../icons";
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
        icon: Icons.HomeIcon,
        items: [],
      },
      {
        title: "Produtos",
        url: "/produtos",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Descrições com IA",
        url: "/produtos/gerar-descricoes",
        icon: Icons.PieChart,
        items: [],
      },
      {
        title: "Clientes",
        url: "/clientes",
        icon: Icons.User,
        items: [],
      },
      {
        title: "Orçamentos",
        url: "/orcamentos",
        icon: Icons.Budget,
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
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Subcategorias",
        url: "/subcategorias",
        icon: Icons.Alphabet,
        items: [],
      },
      {
        title: "Subcategorias por produto",
        url: "/produtos/subcategorias",
        icon: Icons.FourCircle,
        items: [],
      },
      {
        title: "Publicos-alvo",
        url: "/publicos-alvos",
        icon: Icons.FourCircle,
        items: [],
      },
      {
        title: "Datas promocionais",
        url: "/datas-promocionais",
        icon: Icons.Calendar,
        items: [],
      },
      {
        title: "Banners",
        url: "/banners",
        icon: Icons.Banner,
        items: [],
      },
      {
        title: "Landing pages",
        url: "/landing-pages",
        icon: Icons.Website,
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
        icon: Icons.User,
        items: [],
      },
      {
        title: "Permissoes",
        url: "/permissoes",
        icon: Icons.Permission,
        items: [],
      },
    ],
  },
];
