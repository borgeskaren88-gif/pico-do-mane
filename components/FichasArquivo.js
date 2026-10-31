'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, Card, Btn, Empty, PageTitle, inputStyle } from './ui';

// A GALERIA DE FICHAS TÉCNICAS.
//
// "Preciso de um lugar onde eu coloque as fichas técnicas, tipo uma galeria —
// eu já tenho tudo salvo em PDF."
//
// O trabalho dela já estava feito; faltava estar no bar. Em PDF no celular
// dela, a ficha só existe quando ela está presente — e ficha técnica serve
// justamente pra quando ela NÃO está.
//
// A COZINHA VÊ E NÃO MEXE, escolha dela. Quem acrescenta e apaga é a dona:
// ficha apagada no meio do sábado não tem como voltar.
//
// FOTO VIRA MINIATURA, PDF VIRA CAPA COM O NOME GRANDE. Gerar miniatura de PDF
// exigiria baixar um leitor de PDF inteiro pro celular dela antes de desenhar
// a primeira tela — meio megabyte no 4G do bar pra mostrar um quadradinho. O
// nome do prato legível de longe serve melhor, e é o que ela procura.
const tamanhoFalado = (b) => {
  const n = Number(b) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};
const ehFoto = (tipo) => /^image\//.test(String(tipo || ''));

export default function FichasArquivo({ sub = 'As fichas dos teus pratos, onde a cozinha alcança' }) {
  const [fichas, setFichas] = useState([]);
  const [podeMexer, setPodeMexer] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [subindo, setSubindo] = useState('');
  const [editId, setEditId] = useState('');
  const [editNome, setEditNome] = useState('');
  const campoRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/fichas-arquivo', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setFichas(Array.isArray(j.fichas) ? j.fichas : []); setPodeMexer(!!j.podeMexer); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return fichas;
    return fichas.filter((f) => String(f.nome || '').toLowerCase().includes(q));
  }, [fichas, busca]);

  // Vários arquivos de uma vez: ela tem a pasta inteira no celular, e mandar um
  // por um seria o tipo de tarefa que não se termina nunca.
  const mandar = async (lista) => {
    const arquivos = [...(lista || [])];
    if (!arquivos.length) return;
    setErro('');
    for (let i = 0; i < arquivos.length; i++) {
      const a = arquivos[i];
      setSubindo(`Mandando ${i + 1} de ${arquivos.length}: ${a.name}`);
      try {
        const fd = new FormData();
        fd.append('arquivo', a);
        const r = await fetch('/api/fichas-arquivo', { method: 'POST', body: fd });
        const j = await r.json();
        // Para no primeiro erro e DIZ qual arquivo parou. Seguir calado deixaria
        // ela achando que subiu tudo, e a ficha que falta só aparece faltando
        // no dia em que alguém precisa dela.
        if (!j.ok) { setErro(`${a.name}: ${j.erro || 'não deu pra mandar.'}`); break; }
      } catch { setErro(`${a.name}: sem conexão.`); break; }
    }
    setSubindo('');
    if (campoRef.current) campoRef.current.value = '';
    await carregar();
  };

  const apagar = async (f) => {
    if (typeof window !== 'undefined' && !window.confirm(`Apagar a ficha "${f.nome}"? Isso não volta.`)) return;
    try {
      const r = await fetch(`/api/fichas-arquivo?id=${encodeURIComponent(f.id)}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j.ok) setErro(j.erro || 'Não deu pra apagar.');
    } catch { setErro('Sem conexão.'); }
    await carregar();
  };

  const salvarNome = async () => {
    const nome = editNome.trim();
    if (!nome) return;
    try {
      const r = await fetch('/api/fichas-arquivo', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, nome }),
      });
      const j = await r.json();
      if (!j.ok) setErro(j.erro || 'Não deu pra renomear.');
    } catch { setErro('Sem conexão.'); }
    setEditId('');
    await carregar();
  };

  return (
    <div>
      <PageTitle sub={sub}>Fichas em PDF</PageTitle>

      {podeMexer && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Adicionar fichas</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
            Escolhe os PDFs do teu celular — dá pra mandar vários de uma vez. Foto também serve,
            se a ficha estiver escrita à mão.
          </div>
          <input
            ref={campoRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={(e) => mandar(e.target.files)}
            disabled={!!subindo}
            style={{ ...inputStyle, padding: 10, cursor: subindo ? 'default' : 'pointer' }}
          />
          {subindo && <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, marginTop: 10 }}>{subindo}</div>}
        </Card>
      )}

      {erro && (
        <Card style={{ marginBottom: 14, borderColor: C.red }}>
          <div style={{ fontSize: 13.5, color: C.red, fontWeight: 700 }}>{erro}</div>
        </Card>
      )}

      {fichas.length > 3 && (
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar pelo nome do prato…"
          style={{ ...inputStyle, marginBottom: 14 }}
        />
      )}

      {!carregado ? <Empty>Abrindo as fichas…</Empty>
        : visiveis.length === 0 ? (
          <Empty>
            {fichas.length === 0
              ? <>Nenhuma ficha aqui ainda.<br />
                <span style={{ fontSize: 12.5 }}>
                  {podeMexer ? 'Manda os PDFs que tu já tem — eles ficam guardados e a cozinha alcança.' : 'A dona ainda não subiu as fichas.'}
                </span></>
              : 'Nenhuma ficha com esse nome.'}
          </Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
            {visiveis.map((f) => {
              const foto = ehFoto(f.tipo);
              const editando = editId === f.id;
              return (
                <Card key={f.id} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <a
                    href={f.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block', height: 124, textDecoration: 'none',
                      background: foto ? C.panel2 : `linear-gradient(140deg, ${C.accent} 0%, ${C.roxo} 100%)`,
                      position: 'relative', cursor: f.url ? 'pointer' : 'default',
                    }}
                  >
                    {foto && f.url ? (
                      <img src={f.url} alt={f.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
                        <span style={{ color: '#fff', fontSize: 13.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden' }}>
                          {f.nome}
                        </span>
                      </div>
                    )}
                    {!foto && (
                      <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, fontWeight: 900, padding: '3px 6px', borderRadius: 6, letterSpacing: '.05em' }}>PDF</span>
                    )}
                  </a>

                  <div style={{ padding: '9px 10px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {editando ? (
                      <>
                        <input
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); }}
                          style={{ ...inputStyle, fontSize: 13, padding: '7px 9px' }}
                        />
                        <div style={{ display: 'flex', gap: 5 }}>
                          <Btn small onClick={salvarNome}>Salvar</Btn>
                          <Btn kind="ghost" small onClick={() => setEditId('')}>Cancelar</Btn>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Em PDF o nome já está grande na capa; repetir aqui
                            só rouba altura do cartão. Em foto a capa é a foto,
                            então o nome precisa vir embaixo. */}
                        {foto && <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{f.nome}</div>}
                        <div style={{ fontSize: 11, color: C.faint, fontWeight: 700 }}>
                          {foto ? 'foto' : 'PDF'} · {tamanhoFalado(f.tamanho)}
                        </div>
                        {!f.url && <div style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>não deu pra abrir agora</div>}
                        {podeMexer && (
                          <div style={{ display: 'flex', gap: 5, marginTop: 'auto', paddingTop: 4 }}>
                            <button onClick={() => { setEditId(f.id); setEditNome(f.nome || ''); }} style={acaoBtn}>nome</button>
                            <button onClick={() => apagar(f)} style={{ ...acaoBtn, color: C.red }}>apagar</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

const acaoBtn = {
  background: 'none', border: `1px solid ${C.line}`, color: C.muted, cursor: 'pointer',
  fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 7,
};
