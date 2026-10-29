import { TERMS_VERSION } from '@financeiro/shared';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/Logo';

/**
 * Modelos de Termos e Política. Os campos entre colchetes precisam ser preenchidos
 * com os dados da empresa, e o texto revisado por um advogado antes da venda.
 */
const COMPANY = '[RAZÃO SOCIAL]';
const CNPJ = '[CNPJ]';
const CONTACT = '[e-mail de contato]';
const DPO = '[nome e e-mail do encarregado de dados]';

const updatedAt = TERMS_VERSION.split('-').reverse().join('/');

function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-ember-soft px-1 text-ember-deep">{children}</mark>;
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="Financeiro, início">
            <Logo size={26} />
          </Link>
          <Link to="/entrar" className="link-ember inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={15} aria-hidden="true" /> Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-[32px] leading-tight font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate">Atualizado em {updatedAt}</p>
        <article className="mt-8 space-y-8 text-[15px] leading-relaxed text-steel [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-graphite [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:space-y-1">
          {children}
        </article>
      </main>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de uso">
      <section>
        <h2>1. Quem somos e o que oferecemos</h2>
        <p>
          O Financeiro é um serviço on-line de controle financeiro pessoal oferecido por{' '}
          <Placeholder>{COMPANY}</Placeholder>, CNPJ <Placeholder>{CNPJ}</Placeholder>. Ele ajuda
          você a registrar contas, cartões, lançamentos, orçamentos e a projetar o saldo. O
          Financeiro não é banco nem instituição de pagamento: não movimenta seu dinheiro, não
          acessa suas contas bancárias e não faz recomendações de investimento.
        </p>
      </section>
      <section>
        <h2>2. Sua conta</h2>
        <ul>
          <li>Você precisa ter 18 anos ou mais e informar dados verdadeiros, incluindo o CPF.</li>
          <li>
            A senha é pessoal. Avise-nos se suspeitar de uso indevido; você pode encerrar as sessões
            abertas em Configurações → Segurança.
          </li>
          <li>Uma conta é de uma pessoa; não compartilhe o acesso.</li>
        </ul>
      </section>
      <section>
        <h2>3. Planos e pagamento</h2>
        <p>
          Há um plano gratuito com limites e planos pagos com mais recursos. Preços, limites e
          formas de pagamento aparecem na página de planos antes da contratação. Os pagamentos são
          processados pelo Mercado Pago; não guardamos dados do seu cartão.
        </p>
        <p>
          Planos pagos são renovados automaticamente a cada período até o cancelamento, que pode ser
          feito a qualquer momento e vale ao fim do período já pago. Na contratação a distância,
          você pode desistir em até 7 dias e receber o valor de volta (Código de Defesa do
          Consumidor, art. 49).
        </p>
      </section>
      <section>
        <h2>4. Uso permitido</h2>
        <p>
          Não é permitido usar o serviço para atividades ilegais, tentar acessar dados de outras
          pessoas, sobrecarregar ou atacar o sistema, nem automatizar acessos sem autorização.
          Contas que violarem estes termos podem ser suspensas.
        </p>
      </section>
      <section>
        <h2>5. Assistente no WhatsApp</h2>
        <p>
          O uso do WhatsApp é opcional e depende do seu consentimento, que pode ser retirado a
          qualquer momento no perfil. Mensagens trocadas com o assistente seguem também as regras do
          WhatsApp.
        </p>
      </section>
      <section>
        <h2>6. Responsabilidades</h2>
        <p>
          As informações e projeções são calculadas a partir do que você registra e servem para
          planejamento. Decisões financeiras são suas. Trabalhamos para manter o serviço disponível
          e seguro, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros.
        </p>
      </section>
      <section>
        <h2>7. Encerramento</h2>
        <p>
          Você pode baixar seus dados e excluir a conta a qualquer momento em Configurações →
          Segurança. A exclusão apaga seus registros financeiros de forma definitiva.
        </p>
      </section>
      <section>
        <h2>8. Mudanças e contato</h2>
        <p>
          Avisaremos com antecedência sobre mudanças relevantes nestes termos. Dúvidas:{' '}
          <Placeholder>{CONTACT}</Placeholder>. Fica eleito o foro do domicílio do consumidor.
        </p>
      </section>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de privacidade">
      <section>
        <h2>1. Controlador dos dados</h2>
        <p>
          <Placeholder>{COMPANY}</Placeholder>, CNPJ <Placeholder>{CNPJ}</Placeholder>, é a
          controladora dos dados pessoais tratados no Financeiro, nos termos da Lei Geral de
          Proteção de Dados (Lei 13.709/2018). Encarregado: <Placeholder>{DPO}</Placeholder>.
        </p>
      </section>
      <section>
        <h2>2. Quais dados tratamos e por quê</h2>
        <ul>
          <li>
            <strong>Cadastro</strong> (nome, e-mail, CPF e senha protegida por hash): para criar e
            proteger sua conta, permitir o login e evitar contas duplicadas. Base: execução do
            contrato.
          </li>
          <li>
            <strong>Dados financeiros que você registra</strong> (contas, cartões, lançamentos,
            orçamentos): para prestar o serviço. Base: execução do contrato.
          </li>
          <li>
            <strong>Celular</strong>, se você cadastrar: para o assistente no WhatsApp. Base:
            consentimento, que pode ser retirado a qualquer momento.
          </li>
          <li>
            <strong>Dados de acesso</strong> (IP, navegador, data e hora): para segurança, prevenção
            a fraudes e cumprimento do Marco Civil da Internet. Base: obrigação legal e legítimo
            interesse.
          </li>
          <li>
            <strong>Pagamento</strong>: processado pelo Mercado Pago, que recebe os dados
            necessários para a cobrança. Não guardamos número de cartão.
          </li>
        </ul>
      </section>
      <section>
        <h2>3. Com quem compartilhamos</h2>
        <p>
          Apenas com fornecedores necessários para operar o serviço (hospedagem, envio de e-mail,
          pagamento e, se você ativar, WhatsApp), sob contrato e com o mínimo de dados. Não vendemos
          seus dados e não os usamos para publicidade de terceiros.
        </p>
      </section>
      <section>
        <h2>4. Segurança</h2>
        <p>
          Senhas e links de acesso são guardados apenas como hash; a conexão é criptografada; o
          acesso de cada pessoa é restrito aos próprios dados; e há limite de tentativas de login.
          Nenhum sistema é infalível: se houver um incidente relevante, avisaremos você e a ANPD.
        </p>
      </section>
      <section>
        <h2>5. Por quanto tempo guardamos</h2>
        <p>
          Enquanto sua conta existir. Ao excluir a conta, apagamos seus dados financeiros e de
          cadastro. Registros de acesso podem ser mantidos pelo prazo exigido em lei (6 meses).
        </p>
      </section>
      <section>
        <h2>6. Seus direitos</h2>
        <ul>
          <li>Acessar e baixar seus dados (Configurações → Segurança → Baixar meus dados).</li>
          <li>Corrigir dados no perfil.</li>
          <li>Excluir a conta e os dados (Configurações → Segurança).</li>
          <li>Retirar o consentimento do WhatsApp no perfil.</li>
          <li>
            Pedir informações sobre o tratamento pelo e-mail <Placeholder>{CONTACT}</Placeholder>.
          </li>
        </ul>
      </section>
      <section>
        <h2>7. Cookies</h2>
        <p>
          Usamos apenas um cookie essencial, que mantém você conectado com segurança. Não usamos
          cookies de publicidade.
        </p>
      </section>
    </LegalLayout>
  );
}
