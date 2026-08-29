#!/usr/bin/env node
/**
 * Datos de demostracion.
 *
 * No son filas cualquiera: son el ARGUMENTO del producto hecho datos. Dos
 * escuelas de verticales distintas en la MISMA instalacion, con sus periodos y
 * cohortes propios (ciclo/grado vs temporada/categoria), familias con pago
 * dividido entre dos tutores, y consentimientos separados por finalidad.
 * Si el modelo no fuera multi-vertical, este archivo no se podria escribir.
 *
 * Corre con el rol dueno: sembrar no es lo que se esta probando.
 */
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rutaEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const OPCIONES_HASH = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };
const CONTRASENA_DEMO = 'azahar-demo-2026';
const CORREO_CEO = 'abrahag40@gmail.com';

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
await cliente.connect();
const q = (sql, params) => cliente.query(sql, params);

try {
  // Orden inverso al de las dependencias. La bitacora se trunca porque sus
  // reglas append-only bloquean el DELETE incluso para el dueno (§12).
  for (const t of [
    'plataforma.evento',
    'plataforma.cliente',
    'plataforma.miembro',
    'plataforma.socio',
    'notificacion',
    'parte_de_cargo',
    'cargo',
    'concepto_cargo',
    'asistencia',
    'asignacion_docente',
    'configuracion_escuela',
    'tutor_alumno',
    'consentimiento',
    'tutor',
    'inscripcion',
    'alumno',
    'cohorte',
    'periodo',
    'aviso_privacidad',
    'usuario_rol',
    'usuario',
    'sede',
    'tenant',
  ]) {
    await q(`DELETE FROM ${t}`);
  }
  await q('TRUNCATE evento_auditoria');

  const hashDemo = await hash(CONTRASENA_DEMO, OPCIONES_HASH);

  const escuelas = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      nombre: 'Colegio Azahar',
      slug: 'colegio-azahar',
      vertical: 'COLEGIO',
      sedes: [
        // El RVOE va POR NIVEL, que es como lo otorga la autoridad y como lo
        // exige el complemento IEDU. Un campus con primaria y secundaria tiene
        // dos acuerdos distintos, y la factura debe llevar el que corresponde.
        {
          nombre: 'Campus Norte',
          cct: '31PPR0001A',
          rvoes: [
            { nivel: 'PRIMARIA', acuerdo: 'ACUERDO 123/2024' },
            { nivel: 'SECUNDARIA', acuerdo: 'ACUERDO 456/2024' },
          ],
        },
        { nombre: 'Campus Sur', cct: '31PPR0002B', rvoes: [{ nivel: 'PRIMARIA', acuerdo: 'ACUERDO 124/2024' }] },
      ],
      // Un colegio piensa en ciclos escolares y grados.
      periodo: { nombre: 'Ciclo 2026-2027', tipo: 'CICLO_ESCOLAR', inicio: '2026-08-17' },
      cohortes: [
        { nombre: '1o A', tipo: 'GRADO', orden: 1 },
        { nombre: '2o A', tipo: 'GRADO', orden: 2 },
        { nombre: '3o A', tipo: 'GRADO', orden: 3 },
      ],
      usuarios: [
        { email: 'directora@colegioazahar.mx', nombre: 'Lucia Mendoza', roles: ['DIRECTOR'] },
        // El caso que los competidores no modelan: una sola persona con varios
        // roles. En una escuela chica administra Y da clase Y cobra.
        {
          email: 'admin@colegioazahar.mx',
          nombre: 'Marta Ibarra',
          roles: ['ADMIN', 'DOCENTE', 'COBRANZA'],
        },
        // Docente "pura": sin rol de direccion. Es la cuenta que demuestra la
        // regla — ve 1o A porque se le asigno, y NO ve el resto de la escuela.
        {
          email: 'maestra@colegioazahar.mx',
          nombre: 'Beatriz Nava',
          roles: ['DOCENTE'],
          cohortes: [0],
        },
      ],
      alumnos: [
        { nombre: 'Sofia', apellidos: 'Ramirez Loera', nacimiento: '2018-03-12', cohorte: 0 },
        // Mateo entra el 15 de septiembre, un mes despues de arrancar el ciclo:
        // es el caso que hace visible el prorrateo en la demo. Sin un alumno
        // asi, la funcion existe y no se ve.
        {
          nombre: 'Mateo',
          apellidos: 'Ramirez Loera',
          nacimiento: '2016-07-04',
          cohorte: 2,
          altaTardia: '2026-09-15',
        },
      ],
      // Padres separados que dividen la colegiatura 60/40 y una abuela que
      // recoge pero no paga. Es el "tercer pagador" que el mercado pide.
      familia: [
        { nombre: 'Elena', apellidos: 'Loera', parentesco: 'MADRE', paga: 60, recoge: true },
        { nombre: 'Jorge', apellidos: 'Ramirez', parentesco: 'PADRE', paga: 40, recoge: false },
        {
          nombre: 'Carmen',
          apellidos: 'Vda. de Loera',
          parentesco: 'ABUELO',
          paga: null,
          recoge: true,
        },
      ],
      // Lo que cobra un colegio. La colegiatura lleva bandera de deducible y
      // nivel educativo porque el complemento IEDU los exige; el comedor no,
      // porque no es un servicio educativo y no se puede deducir.
      //
      // Las dos banderas del Sprint 5 estan puestas a proposito para que la
      // demo muestre los dos defectos ya corregidos: SOLO la colegiatura cuenta
      // para el Articulo 7 (§52), y la excursion no consume saldo a favor
      // porque se cobra por cuenta del operador que la presta.
      conceptos: [
        {
          clave: 'colegiatura-primaria',
          nombre: 'Colegiatura de primaria',
          periodicidad: 'MENSUAL',
          monto: '2450.00',
          dia: 5,
          deducible: true,
          nivel: 'PRIMARIA',
          esColegiatura: true,
          aceptaSaldoAFavor: true,
        },
        {
          clave: 'inscripcion',
          nombre: 'Inscripción del ciclo',
          periodicidad: 'UNICO',
          monto: '4900.00',
          dia: 15,
          deducible: false,
          nivel: null,
          esColegiatura: false,
          aceptaSaldoAFavor: true,
        },
        {
          clave: 'comedor',
          nombre: 'Comedor',
          periodicidad: 'MENSUAL',
          monto: '850.00',
          dia: 5,
          deducible: false,
          nivel: null,
          esColegiatura: false,
          aceptaSaldoAFavor: true,
        },
        {
          clave: 'excursion-museo',
          nombre: 'Excursión al museo',
          periodicidad: 'UNICO',
          monto: '380.00',
          dia: 20,
          deducible: false,
          nivel: null,
          // No es colegiatura: tres excursiones impagas NO acercan a la familia
          // a la suspension del servicio, por mas que sumen dinero.
          esColegiatura: false,
          // Y es VOLUNTARIA: el Acuerdo prohibe condicionar el servicio a un
          // pago voluntario, asi que solo se le cobra a quien la acepte. Sin
          // aceptaciones, la generacion no crea un solo cargo de excursion —
          // que es justo lo que la demo debe ensenar.
          obligatoriedad: 'VOLUNTARIA',
          // La escuela solo junta el dinero para el operador. Consumir con esto
          // el saldo a favor de la familia sin que nadie lo decida la dejaria
          // sin ese dinero para la colegiatura.
          aceptaSaldoAFavor: false,
        },
      ],
      // Companeros de grupo SIN familia registrada en la app: es el estado real
      // de una escuela recien migrada, donde no todos los tutores se han dado
      // de alta. Sirve para que el pase de lista se vea como se ve de verdad y
      // para probar que una falta sin destinatarios no rompe nada.
      companeros: [
        { nombre: 'Emilia', apellidos: 'Nunez Vargas', cohorte: 0 },
        { nombre: 'Bruno', apellidos: 'Salas Trejo', cohorte: 0 },
        { nombre: 'Ximena', apellidos: 'Ojeda Pineda', cohorte: 0 },
      ],
      // Sofia ya lleva dos faltas recientes: la del dia de la demo sera la
      // tercera y disparara el aviso acumulado con el umbral por omision.
      // Sin este historial habria que esperar tres dias para ver la funcion
      // con mejor evidencia del producto.
      historial: [
        { alumno: 0, cohorte: 0, diasAtras: 6, estado: 'AUSENTE' },
        { alumno: 0, cohorte: 0, diasAtras: 3, estado: 'AUSENTE' },
        { alumno: 0, cohorte: 0, diasAtras: 2, estado: 'PRESENTE' },
        { alumno: 0, cohorte: 0, diasAtras: 1, estado: 'PRESENTE' },
        { alumno: 1, cohorte: 2, diasAtras: 2, estado: 'PRESENTE' },
        { alumno: 1, cohorte: 2, diasAtras: 1, estado: 'RETARDO' },
      ],
      cliente: { estado: 'ACTIVO', plan: 'base', precio: '2400.00', alumnos: 400, modulos: [] },
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      nombre: 'Academia Azahar FC',
      slug: 'academia-azahar',
      vertical: 'ACADEMIA_DEPORTIVA',
      // Una academia no tiene CCT ni RVOE: los campos son opcionales por eso,
      // no por descuido del modelo.
      sedes: [{ nombre: 'Cancha Principal', cct: null, rvoes: [] }],
      // Una academia piensa en temporadas y categorias por edad.
      periodo: { nombre: 'Temporada Otono 2026', tipo: 'TEMPORADA', inicio: '2026-09-01' },
      cohortes: [
        { nombre: 'Sub-10', tipo: 'CATEGORIA', orden: 10 },
        { nombre: 'Sub-12', tipo: 'CATEGORIA', orden: 12 },
      ],
      usuarios: [
        { email: 'coach@academiaazahar.mx', nombre: 'Rene Palacios', roles: ['DUENO'] },
        {
          email: 'auxiliar@academiaazahar.mx',
          nombre: 'Ivan Cruz',
          roles: ['DOCENTE'],
          cohortes: [1],
        },
      ],
      alumnos: [
        { nombre: 'Diego', apellidos: 'Fuentes Ortiz', nacimiento: '2015-11-20', cohorte: 1 },
      ],
      familia: [
        { nombre: 'Paola', apellidos: 'Ortiz', parentesco: 'MADRE', paga: 100, recoge: true },
      ],
      // Una academia deportiva NO emite colegiaturas deducibles: no es un
      // servicio educativo con RVOE. Que el mismo modelo sirva a las dos sin
      // ramas es justamente el punto (§9).
      conceptos: [
        {
          clave: 'mensualidad',
          nombre: 'Mensualidad Sub-12',
          periodicidad: 'MENSUAL',
          monto: '890.00',
          dia: 10,
          deducible: false,
          nivel: null,
          // Es la cuota periodica de esta academia, asi que se cuenta para la
          // mora. Pero el vertical es ACADEMIA_DEPORTIVA: el Acuerdo de PROFECO
          // no la alcanza (§51) y el panel se lo dice en vez de citarle una ley
          // que no la obliga.
          esColegiatura: true,
          aceptaSaldoAFavor: true,
        },
      ],
      historial: [
        { alumno: 0, cohorte: 1, diasAtras: 4, estado: 'PRESENTE' },
        { alumno: 0, cohorte: 1, diasAtras: 1, estado: 'AUSENTE' },
      ],
      cliente: {
        estado: 'CORTESIA',
        plan: 'base',
        precio: '890.00',
        alumnos: 150,
        modulos: ['AZ-A3'],
      },
    },
  ];

  // --- Plataforma: el socio y el CEO ---------------------------------------
  const idSocio = '33333333-3333-4333-8333-333333333333';
  await q(
    `INSERT INTO plataforma.socio (id, nombre, email, porcentaje_comision, activo, creado_en)
     VALUES ($1, 'Distribuidora Bajio', 'socio@bajio.mx', 15.00, true, now())`,
    [idSocio],
  );
  await q(
    `INSERT INTO plataforma.miembro (id, email, nombre, rol, socio_id, activo, creado_en) VALUES
       (gen_random_uuid(), $1, 'Abraham (ZaharDev)', 'CEO', NULL, true, now()),
       (gen_random_uuid(), 'socio@bajio.mx', 'Distribuidora Bajio', 'SOCIO', $2, true, now())`,
    [CORREO_CEO, idSocio],
  );

  for (const e of escuelas) {
    await q(
      `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn")
       VALUES ($1, $2, $3, $4::"Vertical", true, now())`,
      [e.id, e.nombre, e.slug, e.vertical],
    );

    const sedeIds = [];
    for (const s of e.sedes) {
      const { rows } = await q(
        `INSERT INTO sede (id, tenant_id, nombre, cct, activa, "creadaEn")
         VALUES (gen_random_uuid(), $1, $2, $3, true, now()) RETURNING id`,
        [e.id, s.nombre, s.cct],
      );
      sedeIds.push(rows[0].id);

      for (const r of s.rvoes ?? []) {
        await q(
          `INSERT INTO rvoe (id, tenant_id, sede_id, nivel_educativo, acuerdo, creado_en)
           VALUES (gen_random_uuid(), $1, $2, $3::"NivelEducativo", $4, now())`,
          [e.id, rows[0].id, r.nivel, r.acuerdo],
        );
      }
    }

    const idsDeUsuario = {};
    for (const u of e.usuarios) {
      const { rows } = await q(
        `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, now()) RETURNING id`,
        [e.id, u.email, hashDemo, u.nombre],
      );
      idsDeUsuario[u.email] = rows[0].id;
      for (const rol of u.roles) {
        await q(
          `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
           VALUES (gen_random_uuid(), $1, $2, $3::"Rol", now())`,
          [e.id, rows[0].id, rol],
        );
      }
    }

    const { rows: per } = await q(
      `INSERT INTO periodo (id, tenant_id, nombre, tipo, inicio, activo, creado_en)
       VALUES (gen_random_uuid(), $1, $2, $3::"TipoPeriodo", $4::date, true, now()) RETURNING id`,
      [e.id, e.periodo.nombre, e.periodo.tipo, e.periodo.inicio],
    );

    const cohorteIds = [];
    for (const c of e.cohortes) {
      const { rows } = await q(
        `INSERT INTO cohorte (id, tenant_id, periodo_id, sede_id, nombre, tipo, orden, activa, creada_en)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"TipoCohorte", $6, true, now()) RETURNING id`,
        [e.id, per[0].id, sedeIds[0], c.nombre, c.tipo, c.orden],
      );
      cohorteIds.push(rows[0].id);
    }

    // Parametros de asistencia y cobranza. Se siembran explicitos aunque
    // coincidan con los valores por omision: una escuela sin fila dependeria
    // del default del codigo, y el dia que ese default cambie, cambiaria bajo
    // sus pies.
    //
    // El recargo va en 3.5% para que la demo lo ejercite. Los diez dias de
    // gracia NO se pueden bajar de ahi por mucho que se configure: el piso lo
    // impone el dominio (Art. 4 del Acuerdo DOF 10-mar-1992).
    await q(
      `INSERT INTO configuracion_escuela
         (id, tenant_id, umbral_faltas, ventana_dias, avisar_falta_del_dia, zona_horaria,
          dia_vencimiento_por_omision, dias_gracia_sin_recargo, recargo_porcentaje, actualizado_en)
       VALUES (gen_random_uuid(), $1, 3, 30, true, 'America/Mexico_City', 5, 10, 3.50, now())`,
      [e.id],
    );

    // El catalogo de cargos: de aqui sale lo que cada alumno debe cada mes.
    for (const c of e.conceptos ?? []) {
      await q(
        `INSERT INTO concepto_cargo
           (id, tenant_id, clave, nombre, periodicidad, monto_base, dia_vencimiento,
            deducible_iedu, nivel_educativo, es_colegiatura, acepta_saldo_a_favor,
            obligatoriedad, vigente_desde, avisado_en, activo, creado_en, actualizado_en)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::"Periodicidad", $5, $6, $7,
                 $8::"NivelEducativo", $9, $10, $11::"Obligatoriedad", $12::date, $13::date,
                 true, now(), now())`,
        [
          e.id,
          c.clave,
          c.nombre,
          c.periodicidad,
          c.monto,
          c.dia,
          c.deducible,
          c.nivel,
          c.esColegiatura ?? false,
          c.aceptaSaldoAFavor ?? true,
          c.obligatoriedad ?? 'OBLIGATORIA',
          e.periodo.inicio,
          // Avisado con mas de 60 dias de anticipacion respecto a la vigencia,
          // como exige el Articulo 5-I: la demo tiene que ser un ejemplo valido.
          new Date(new Date(e.periodo.inicio).getTime() - 90 * 864e5).toISOString().slice(0, 10),
        ],
      );
    }

    // Quien pasa lista de que grupo. Tabla y no columna: hay co-docencia.
    for (const u of e.usuarios.filter((x) => x.cohortes)) {
      for (const indice of u.cohortes) {
        await q(
          `INSERT INTO asignacion_docente (id, tenant_id, usuario_id, cohorte_id, titular, creada_en)
           VALUES (gen_random_uuid(), $1, $2, $3, true, now())`,
          [e.id, idsDeUsuario[u.email], cohorteIds[indice]],
        );
      }
    }

    // Aviso de privacidad versionado: los consentimientos apuntan a la version
    // exacta que el tutor acepto (LFPDPPP 2025).
    const { rows: aviso } = await q(
      `INSERT INTO aviso_privacidad (id, tenant_id, version, contenido, publicado_en)
       VALUES (gen_random_uuid(), $1, 1, $2, now()) RETURNING id`,
      [e.id, `Aviso de privacidad de ${e.nombre}, version 1 (demo).`],
    );

    const alumnoIds = [];
    for (const a of e.alumnos) {
      const { rows } = await q(
        `INSERT INTO alumno (id, tenant_id, nombre, apellidos, fecha_nacimiento, activo, creado_en)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::date, true, now()) RETURNING id`,
        [e.id, a.nombre, a.apellidos, a.nacimiento],
      );
      alumnoIds.push(rows[0].id);
      // La fecha de alta manda el PRORRATEO (AZ-M4.1), asi que se siembra con
      // intencion y no con `now()`: quien se inscribe al arrancar el ciclo paga
      // el periodo completo, y `altaTardia` deja a un alumno entrando a mitad
      // para que la demo ensene el prorrateo de verdad.
      await q(
        `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
         VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVA', $4::date)`,
        [e.id, rows[0].id, cohorteIds[a.cohorte], a.altaTardia ?? e.periodo.inicio],
      );
    }

    // Historial de asistencia. Registrado a nombre de un docente real de la
    // escuela: `registrado_por` es una coordenada de auditoria (§37) y sembrar
    // un uuid inventado dejaria la bitacora apuntando a nadie.
    const quienRegistra = Object.values(idsDeUsuario)[0];
    for (const h of e.historial ?? []) {
      const fecha = new Date(Date.now() - h.diasAtras * 864e5).toISOString().slice(0, 10);
      await q(
        `INSERT INTO asistencia
           (id, tenant_id, alumno_id, cohorte_id, fecha, estado, registrado_por, registrado_en)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5::"EstadoAsistencia", $6, now())`,
        [e.id, alumnoIds[h.alumno], cohorteIds[h.cohorte], fecha, h.estado, quienRegistra],
      );
    }

    for (const t of e.familia) {
      const correoTutor = `${t.nombre.toLowerCase()}@ejemplo.mx`;

      // Cada tutor recibe cuenta de acceso a la app (Sprint 2). El rol TUTOR es
      // uno mas del catalogo: la misma persona podria ademas ser docente y
      // entraria una sola vez, con los dos roles.
      const { rows: usr } = await q(
        `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, now()) RETURNING id`,
        [e.id, correoTutor, hashDemo, `${t.nombre} ${t.apellidos}`],
      );
      await q(
        `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
         VALUES (gen_random_uuid(), $1, $2, 'TUTOR', now())`,
        [e.id, usr[0].id],
      );

      const { rows } = await q(
        `INSERT INTO tutor (id, tenant_id, nombre, apellidos, email, usuario_id, creado_en)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now()) RETURNING id`,
        [e.id, t.nombre, t.apellidos, correoTutor, usr[0].id],
      );
      // Cada tutor se vincula a TODOS los alumnos de su escuela demo (son
      // hermanos en el caso del colegio: el descuento por hermanos de S4
      // necesitara exactamente esta forma).
      for (const alumnoId of alumnoIds) {
        await q(
          `INSERT INTO tutor_alumno
             (id, tenant_id, tutor_id, alumno_id, parentesco, es_pagador, porcentaje_pago,
              es_contacto_emergencia, puede_recoger, creado_en)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::"Parentesco", $5, $6, $7, $8, now())`,
          [e.id, rows[0].id, alumnoId, t.parentesco, t.paga !== null, t.paga, t.recoge, t.recoge],
        );
      }
      // Necesarias otorgadas; voluntarias con respuestas distintas — que es
      // exactamente el punto: son separables (§10).
      for (const [finalidad, otorgado] of [
        ['GESTION_ESCOLAR', true],
        ['COBRANZA', true],
        ['COMUNICACION_OPERATIVA', true],
        ['IMAGENES', t.recoge], // demo: unos aceptan fotos, otros no
        ['COMUNICACION_COMERCIAL', false],
      ]) {
        await q(
          `INSERT INTO consentimiento
             (id, tenant_id, aviso_id, tutor_id, finalidad, otorgado, canal, otorgado_en)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::"Finalidad", $5, 'PAPEL', now())`,
          [e.id, aviso[0].id, rows[0].id, finalidad, otorgado],
        );
      }
    }

    // Despues del bloque de familia a proposito: el vinculo tutor-alumno de
    // arriba abarca a los alumnos ya creados, y estos no deben quedar como
    // hijos de Elena.
    for (const c of e.companeros ?? []) {
      const { rows } = await q(
        `INSERT INTO alumno (id, tenant_id, nombre, apellidos, activo, creado_en)
         VALUES (gen_random_uuid(), $1, $2, $3, true, now()) RETURNING id`,
        [e.id, c.nombre, c.apellidos],
      );
      await q(
        `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
         VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVA', $4::date)`,
        [e.id, rows[0].id, cohorteIds[c.cohorte], e.periodo.inicio],
      );
    }

    // La escuela como CLIENTE de ZaharDev. La academia llega por el socio.
    const porSocio = e.vertical === 'ACADEMIA_DEPORTIVA' ? idSocio : null;
    await q(
      `INSERT INTO plataforma.cliente
         (id, tenant_id, estado, plan, precio_mensual, moneda, alumnos_maximos,
          modulos_activos, cortesia_hasta, socio_id, alta_en)
       VALUES (gen_random_uuid(), $1, $2::plataforma."EstadoCliente", $3, $4, 'MXN', $5, $6,
               $7, $8, now())`,
      [
        e.id,
        e.cliente.estado,
        e.cliente.plan,
        e.cliente.precio,
        e.cliente.alumnos,
        e.cliente.modulos,
        e.cliente.estado === 'CORTESIA' ? new Date(Date.now() + 30 * 864e5) : null,
        porSocio,
      ],
    );
    await q(
      `INSERT INTO plataforma.evento (id, tenant_id, actor_email, tipo, ocurrido_en, monto_mxn)
       VALUES (gen_random_uuid(), $1, $2, 'cliente.alta', now(), $3)`,
      [e.id, CORREO_CEO, e.cliente.precio],
    );

    console.log(
      `[seed] ${e.nombre} (${e.vertical}) — ${e.cohortes.length} cohortes, ` +
        `${e.alumnos.length + (e.companeros ?? []).length} alumnos, ` +
        `${e.familia.length} tutores, ` +
        `${(e.historial ?? []).length} registros de asistencia, ` +
        `${(e.conceptos ?? []).length} conceptos de cobro, cliente ${e.cliente.estado}`,
    );
  }

  // --- Espacio propio de ZaharDev ------------------------------------------
  // El CEO necesita una cuenta con la cual iniciar sesion, y esa cuenta debe
  // vivir en SU propio espacio — jamas dentro de una escuela cliente (lo
  // contrario mezclaria al proveedor con su cliente y, peor, haria que una
  // cuenta compartible pudiera heredar acceso a la consola).
  // Este tenant NO tiene fila en plataforma.cliente: ZaharDev no se factura a
  // si misma, y por eso tampoco aparece en la cartera.
  const idZahar = '44444444-4444-4444-8444-444444444444';
  await q(
    `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn")
     VALUES ($1, 'ZaharDev', 'zahardev', 'TALLER', true, now())`,
    [idZahar],
  );
  const { rows: sedeZahar } = await q(
    `INSERT INTO sede (id, tenant_id, nombre, activa, "creadaEn")
     VALUES (gen_random_uuid(), $1, 'Oficina', true, now()) RETURNING id`,
    [idZahar],
  );
  const { rows: usrZahar } = await q(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn")
     VALUES (gen_random_uuid(), $1, $2, $3, 'Abraham', true, now()) RETURNING id`,
    [idZahar, CORREO_CEO, hashDemo],
  );
  await q(
    `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
     VALUES (gen_random_uuid(), $1, $2, 'DUENO', now())`,
    [idZahar, usrZahar[0].id],
  );
  // La cuenta del socio vive tambien aqui: entra al sistema y ve SU cartera.
  const { rows: usrSocio } = await q(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn")
     VALUES (gen_random_uuid(), $1, 'socio@bajio.mx', $2, 'Distribuidora Bajio', true, now())
     RETURNING id`,
    [idZahar, hashDemo],
  );
  await q(
    `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, sede_id, creado_en)
     VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, now())`,
    [idZahar, usrSocio[0].id, sedeZahar[0].id],
  );
  console.log(`[seed] ZaharDev (espacio propio) — cuentas de plataforma con acceso al sistema`);

  console.log(`[seed] plataforma: CEO ${CORREO_CEO} + socio Distribuidora Bajio (15%)`);
  console.log(`[seed] listo. Contrasena de todas las cuentas demo: ${CONTRASENA_DEMO}`);
} finally {
  await cliente.end();
}
