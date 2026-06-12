import Signin from "@/components/Auth/Signin";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-screen-xsm overflow-hidden rounded-lg bg-white shadow-1 dark:bg-gray-dark">
          <section className="flex items-center px-8 py-10 sm:px-12">
            <div className="w-full">
              <h1 className="mb-2 text-3xl font-bold text-dark dark:text-white">
                Acesse o Sistema
              </h1>
              <p className="mb-8 text-sm text-dark-4 dark:text-dark-6">
                Entre com seu usuario para gerenciar catalogo, clientes e permissoes.
              </p>
              <Signin />
            </div>
          </section>
      </div>
    </div>
  );
}
