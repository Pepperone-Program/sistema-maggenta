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
        title: "Clientes",
        url: "/clientes",
        icon: Icons.User,
        items: [],
      },
      {
        title: "Orçamentos",
        url: "/orcamentos",
        icon: Icons.Calendar,
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
        title: "Publicos-alvo",
        url: "/publicos-alvos",
        icon: Icons.FourCircle,
        items: [],
      },
      {
        title: "Datas promocionais",
        url: "/datas-promocionais",
        icon: Icons.PieChart,
        items: [],
      },
      {
        title: "Banners",
        url: "/banners",
        icon: Icons.Table,
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
        icon: Icons.Authentication,
        items: [],
      },
      {
        title: "Permissoes",
        url: "/permissoes",
        icon: Icons.User,
        items: [],
      },
    ],
  },
];
