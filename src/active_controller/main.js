/* ***** BEGIN LICENSE BLOCK *****
 * 
 * Copyright (c) 2009 Aptana, Inc.
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 * 
 * ***** END LICENSE BLOCK ***** */

/**
 * @namespace {ActiveController}
 * @example
 * 
 * ActiveController
 * ================
 * Tutorial coming soon.
 */
ActiveController = {};

ActiveController.logging = false;

ActiveController.create = function create(actions,methods)
{
    var klass = {};
    ActiveSupport.extend(klass,ClassMethods);
    klass.reset();
    for(var action_name in actions || {})
    {
        if(typeof(actions[action_name]) == 'function')
        {
            ActiveController.createAction(klass,action_name,actions[action_name]);
        }
        else
        {
            //plain old property
            klass[action_name] = actions[action_name];
        }
    }
    ActiveSupport.extend(klass,methods || {});
    ActiveEvent.extend(klass);
    return klass;
};

ActiveController.createAction = function createAction(klass,action_name,action)
{
    klass[action_name] = function action_wrapper(){
        if(arguments[0] && typeof(arguments[0]) == 'object')
        {
            this.params = arguments[0];
        }
        var suppress_routes = (arguments.length == 2 && arguments[1] === false);
        this.notify('beforeCall',action_name,this.params);
        if(!this.setupComplete)
        {
            this.setup();
        }
        this.renderLayout();
        if(ActiveController.routes && !suppress_routes)
        {
            ActiveController.setRoute(klass,action_name,this.params);
        }
        ActiveSupport.bind(action,this)();
        this.notify('afterCall',action_name,this.params);
    };
};

ActiveController.createDefaultElement = function createDefaultElement()
{
    var global_context = ActiveSupport.getGlobalContext();
    var div = ActiveView.Builder.div();
    if(!global_context.document.body)
    {
        return ActiveSupport.throwError(Errors.BodyNotAvailable);
    }
    global_context.document.body.appendChild(div);
    return div;
};

var ClassMethods = (function(){
    return {
        reset: function reset()
        {
            this.setupComplete = false;
            this.params = {};
            this.scope = new ActiveEvent.ObservableHash({});
            this.container = false;
        },
        setup: function setup(container,params)
        {
            if(container)
            {
                this.container = container;
            }
            else
            {
                this.container = this.createDefaultElement();
            }
            this.setRenderTarget(this.container);
            if(this.params)
            {
                ActiveSupport.extend(this.params,params);
            }
            if(this.initialize)
            {
                this.initialize();
            }
            this.setupComplete = true;
        },
        getElement: function getElement()
        {
            return this.container;
        },
        createDefaultElement: function createDefaultElement(){
            return ActiveController.createDefaultElement();
        },
        get: function get(key)
        {
            return this.scope.get(key);
        },
        set: function set(key,value)
        {
            return this.scope.set(key,value);
        },
        render: function render(params)
        {
            if(typeof(params) !== 'object')
            {
                return ActiveSupport.throwError(Errors.InvalidRenderParams);
            }
            for(var flag_name in params || {})
            {
                if(!RenderFlags[flag_name])
                {
                    if(ActiveController.logging)
                    {
                        ActiveSupport.log('ActiveController: render() failed with params:',params);
                    }
                    return ActiveSupport.throwError(Errors.UnknownRenderFlag,flag_name);
                }
                ActiveSupport.bind(RenderFlags[flag_name],this)(params[flag_name],params);
            }
            return params;
        },
        getRenderTarget: function getRenderTarget()
        {
            return this.renderTarget;
        },
        setRenderTarget: function setRenderTarget(target)
        {
            this.renderTarget = target;
        },
        renderLayout: function renderLayout()
        {
            if(this.layout && !this.layoutInstance)
            {
                if(!ActiveView.isActiveViewClass(this.layout))
                {
                    return ActiveSupport.throwError(Errors.LayoutIsNotActiveViewClass,this.container);
                }
                this.layout.prototype.originalStructure = this.layout.prototype.structure;
                this.layout.prototype.structure = ActiveSupport.curry(this.layout.prototype.originalStructure,this);
                this.layoutInstance = new this.layout();
                this.setRenderTarget(this.layoutInstance.getTarget());
                ActiveView.Builder.clearElement(this.container);
                this.container.appendChild(this.layoutInstance.getElement());
            }
        },
        createAction: function createAction(action_name,action)
        {
            return ActiveController.createAction(this,action_name,action);
        }
    };
})();
ActiveController.ClassMethods = ClassMethods;

var RenderFlags = {
    view: function view(view_class,params)
    {
        if(typeof(view_class) === 'string')
        {
            var klass = ActiveSupport.getClass(view_class);
            if(!klass)
            {
                return ActiveSupport.throwError(Errors.ViewDoesNotExist,view_class);
            }
        }
        else
        {
            klass = view_class;
        }
        var response = ActiveView.render(klass,params.scope || this.scope);
        var container = params.target || this.getRenderTarget();
        if(container)
        {
            if(params.transition)
            {
                params.transition(container,response);
            }
            else
            {
                ActiveView.Builder.clearElement(container);
                container.appendChild(response);
            }
        }
    },
    text: function text(text,params)
    {
        var container = params.target || this.getRenderTarget();
        if(container)
        {
            container.innerHTML = text;
        }
    },
    target: function target(target,params)
    {
        //target only available for text + view, needs no processing
    },
    transition: function transition(target,params)
    {
        //transition only available for text + view, needs no processing
    },
    scope: function scope(scope,params)
    {
        //scope only available for text + view, needs no processing
    }
};
ActiveController.RenderFlags = RenderFlags;

var Errors = {
    BodyNotAvailable: ActiveSupport.createError('Controller could not attach to a DOM element, no container was passed and document.body is not available'),
    InvalidRenderParams: ActiveSupport.createError('The parameter passed to render() was not an object.'),
    UnknownRenderFlag: ActiveSupport.createError('The following render flag does not exist: '),
    ViewDoesNotExist: ActiveSupport.createError('The specified view does not exist: '),
    LayoutIsNotActiveViewClass: ActiveSupport.createError('The layout defined by the controller is not an ActiveView class:')
};
ActiveController.Errors = Errors;