(() => {
  const page = document.querySelector('#landingPage');

  const open = () => {
    page.classList.add('hidden');
    document.body.classList.add('workspace-mode');
    location.hash = 'workspace';

    const actions = document.querySelector('.header-actions');
    let back = document.querySelector('#backToHome');
    let reset = document.querySelector('#resetWorkspace');

    if (!back) {
      back = document.createElement('button');
      back.id = 'backToHome';
      back.className = 'icon-button';
      back.title = 'Back to Datalyst home';
      back.textContent = '←';
      actions?.prepend(back);
      back.onclick = () => {
        document.body.classList.remove('workspace-mode');
        page.classList.remove('hidden');
        history.replaceState({}, document.title, location.pathname);
      };
    }

    if (!reset) {
      reset = document.createElement('button');
      reset.id = 'resetWorkspace';
      reset.className = 'team-button';
      reset.textContent = 'Reset workspace';
      actions?.prepend(reset);
      reset.onclick = () => {
        location.href = `${location.pathname}#workspace`;
      };
    }
  };

  document.querySelectorAll('[data-open-workspace]').forEach(button => {
    button.onclick = open;
  });

  document.querySelectorAll('[data-auth="login"]').forEach(button => {
    button.onclick = () =>
      window.datalystAuth?.login?.() ||
      toast('Finish Auth0 setup in runtime-config.js to enable login.');
  });

  document.querySelectorAll('[data-auth="signup"]').forEach(button => {
    button.onclick = () =>
      window.datalystAuth?.signup?.() ||
      toast('Finish Auth0 setup in runtime-config.js to enable sign-up.');
  });

  document.querySelectorAll('[data-contact]').forEach(button => {
    button.onclick = () =>
      toast('Contact sales at hello@datalyst.example');
  });

  if (location.hash === '#workspace') {
    open();
  }
})();
