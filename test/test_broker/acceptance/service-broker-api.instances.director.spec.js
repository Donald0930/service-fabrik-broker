'use strict';

const _ = require('lodash');
const lib = require('../../../broker/lib');
const errors = require('../../../broker/lib/errors');
const Promise = require('bluebird');
const app = require('../support/apps').internal;
const utils = lib.utils;
const config = lib.config;
const catalog = lib.models.catalog;
const fabrik = lib.fabrik;
const backupStore = lib.iaas.backupStore;
const ScheduleManager = require('../../../broker/lib/jobs');
const CONST = require('../../../broker/lib/constants');
const DirectorManager = lib.fabrik.DirectorManager;
const cloudController = require('../../../broker/lib/cf').cloudController;

describe('service-broker-api', function () {
  describe('instances', function () {
    /* jshint expr:true */
    describe('director', function () {
      const base_url = '/cf/v2';
      const index = mocks.director.networkSegmentIndex;
      const api_version = '2.12';
      const service_id = '24731fb8-7b84-4f57-914f-c3d55d793dd4';
      const plan_id = 'bc158c9a-7934-401e-94ab-057082a5073f';
      const service_plan_guid = '466c5078-df6e-427d-8fb2-c76af50c0f56';
      const plan = catalog.getPlan(plan_id);
      const plan_id_deprecated = 'b91d9512-b5c9-4c4a-922a-fa54ae67d235';
      const organization_guid = 'b8cbbac8-6a20-42bc-b7db-47c205fccf9a';
      const space_guid = 'e7c0a437-7585-4d75-addf-aa4d45b49f3a';
      const instance_id = mocks.director.uuidByIndex(index);
      const deployment_name = mocks.director.deploymentNameByIndex(index);
      const binding_id = 'd336b15c-37d6-4249-b3c7-430d5153a0d8';
      const app_guid = 'app-guid';
      const task_id = 4711;
      const parameters = {
        foo: 'bar'
      };
      const deploymentHookRequestBody = {
        phase: 'PreCreate',
        actions: ['Blueprint', 'ReserveIps'],
        context: {
          params: {
            context: {
              platform: 'cloudfoundry',
              organization_guid: 'b8cbbac8-6a20-42bc-b7db-47c205fccf9a',
              space_guid: 'e7c0a437-7585-4d75-addf-aa4d45b49f3a'
            },
            organization_guid: 'b8cbbac8-6a20-42bc-b7db-47c205fccf9a',
            space_guid: 'e7c0a437-7585-4d75-addf-aa4d45b49f3a',
            parameters: {
              'foo': 'bar'
            },
            service_id: '24731fb8-7b84-4f57-914f-c3d55d793dd4',
            plan_id: 'bc158c9a-7934-401e-94ab-057082a5073f'
          },
          deployment_name: 'service-fabrik-0021-b4719e7c-e8d3-4f7f-c515-769ad1c3ebfa',
          sf_operations_args: {},
          instance_guid: 'b4719e7c-e8d3-4f7f-c515-769ad1c3ebfa'
        }
      };
      const accepts_incomplete = true;
      const protocol = config.external.protocol;
      const host = config.external.host;
      const dashboard_url = `${protocol}://${host}/manage/instances/${service_id}/${plan_id}/${instance_id}`;
      const container = backupStore.containerName;
      const deferred = Promise.defer();
      Promise.onPossiblyUnhandledRejection(() => {});
      let getScheduleStub;

      before(function () {
        backupStore.cloudProvider = new lib.iaas.CloudProviderClient(config.backup.provider);
        mocks.cloudProvider.auth();
        mocks.cloudProvider.getContainer(container);
        _.unset(fabrik.DirectorManager, plan_id);
        getScheduleStub = sinon.stub(ScheduleManager, 'getSchedule');
        getScheduleStub.withArgs().returns(deferred.promise);
        plan.service.subnet = null;
        return mocks.setup([
          fabrik.DirectorManager.load(plan),
          backupStore.cloudProvider.getContainer()
        ]);
      });

      afterEach(function () {
        mocks.reset();
        getScheduleStub.reset();
      });

      after(function () {
        getScheduleStub.restore();
      });

      describe('#provision', function () {
        it('returns 202 Accepted', function () {
          mocks.director.getDeployments({
            queued: true
          });
          mocks.director.createOrUpdateDeploymentOp(task_id, 'create');
          mocks.deploymentHookClient.executeDeploymentActions(200, deploymentHookRequestBody);
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              organization_guid: organization_guid,
              space_guid: space_guid,
              parameters: parameters
            })
            .then(res => {
              expect(res).to.have.status(202);
              expect(res.body.dashboard_url).to.equal(dashboard_url);
              expect(res.body).to.have.property('operation');
              const decoded = utils.decodeBase64(res.body.operation);
              expect(_.pick(decoded, ['type', 'parameters', 'context'])).to.eql({
                type: 'create',
                parameters: parameters,
                context: {
                  platform: 'cloudfoundry',
                  organization_guid: organization_guid,
                  space_guid: space_guid
                }
              });
              expect(decoded.task_id).to.eql(`${deployment_name}_${task_id}`);
              mocks.verify();
            });
        });
        it('no context returns 202 Accepted', function () {
          mocks.director.getDeployments({
            queued: true
          });
          mocks.deploymentHookClient.executeDeploymentActions(200, deploymentHookRequestBody);
          mocks.director.createOrUpdateDeploymentOp(task_id, 'create');
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              organization_guid: organization_guid,
              space_guid: space_guid,
              parameters: parameters
            })
            .then(res => {
              expect(res).to.have.status(202);
              expect(res.body.dashboard_url).to.equal(dashboard_url);
              expect(res.body).to.have.property('operation');
              const decoded = utils.decodeBase64(res.body.operation);
              expect(_.pick(decoded, ['type', 'parameters', 'context'])).to.eql({
                type: 'create',
                parameters: parameters,
                context: {
                  platform: 'cloudfoundry',
                  organization_guid: organization_guid,
                  space_guid: space_guid
                }
              });
              expect(decoded.task_id).to.eql(`${deployment_name}_${task_id}`);
              mocks.verify();
            });
        });
        it('returns 202 Accepted: In K8S platform', function () {
          mocks.director.getDeployments({
            queued: true
          });
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context.params.context = _.chain(expectedRequestBody.context.params.context)
            .set('namespace', 'default')
            .set('platform', 'kubernetes')
            .omit('organization_guid')
            .omit('space_guid')
            .value();
          mocks.director.createOrUpdateDeployment(task_id, 'create');
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'kubernetes',
                namespace: 'default'
              },
              organization_guid: organization_guid,
              space_guid: space_guid,
              parameters: parameters
            })
            .then(res => {
              expect(res).to.have.status(202);
              expect(res.body.dashboard_url).to.equal(dashboard_url);
              expect(res.body).to.have.property('operation');
              const decoded = utils.decodeBase64(res.body.operation);
              expect(_.pick(decoded, ['type', 'parameters', 'context'])).to.eql({
                type: 'create',
                parameters: parameters,
                context: {
                  platform: 'kubernetes',
                  namespace: 'default'
                }
              });
              expect(decoded.task_id).to.eql(`${deployment_name}_${task_id}`);
              mocks.verify();
            });
        });
        it('returns 202 Accepted when invoked with bosh name', function () {
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          _.chain(expectedRequestBody.context)
            .set('deployment_name', deployment_name)
            .set('instance_guid', instance_id)
            .set('sf_operations_args', {
              'bosh_director_name': 'bosh'
            })
            .value();
          _.chain(expectedRequestBody.context.params)
            .set('accepts_incomplete', true)
            .value();
          expectedRequestBody.context.params.parameters = _.chain(expectedRequestBody.context.params.parameters)
            .set('bosh_director_name', 'bosh')
            .omit('foo')
            .set('username', 'admin')
            .set('password', 'admin')
            .value();
          // expectedRequestBody.context.params.context = _.chain(expectedRequestBody.context.params.context)
          //   .set('namespace', 'default')
          //   .set('platform', 'kubernetes')
          //   .omit('organization_guid')
          //   .omit('space_guid')
          //   .value();
          mocks.director.getDeployments({
            queued: true
          });
          mocks.director.createOrUpdateDeployment(task_id);
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.uaa.getAccessToken();
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              organization_guid: organization_guid,
              space_guid: space_guid,
              parameters: {
                bosh_director_name: 'bosh',
                username: 'admin',
                password: 'admin'
              },
              accepts_incomplete: accepts_incomplete
            })
            .then(res => {
              expect(res).to.have.status(202);
              expect(res.body.dashboard_url).to.equal(dashboard_url);
              expect(res.body).to.have.property('operation');
              const decoded = utils.decodeBase64(res.body.operation);
              expect(_.pick(decoded, ['type', 'parameters', 'context'])).to.eql({
                type: 'create',
                parameters: {
                  bosh_director_name: 'bosh',
                  username: 'admin',
                  password: 'admin'
                },
                context: {
                  platform: 'cloudfoundry',
                  organization_guid: organization_guid,
                  space_guid: space_guid
                }
              });
              mocks.verify();
            });
        });

        it('returns 403 for deprecated plan', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id_deprecated,
              organization_guid: organization_guid,
              space_guid: space_guid,
              parameters: parameters,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              }
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(403);
            });
        });

        it('returns 422 Unprocessable Entity when accepts_incomplete not passed in query', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}`)
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              parameters: parameters
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(422);
              expect(res.body.error).to.be.eql('AsyncRequired');
              expect(res.body.description).to.be.eql('This request requires client support for asynchronous service operations.');
            });
        });

        it('returns 422 Unprocessable Entity when accepts_incomplete undefined', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=`)
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              parameters: parameters,
              accepts_incomplete: accepts_incomplete
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(422);
              expect(res.body.error).to.be.eql('AsyncRequired');
              expect(res.body.description).to.be.eql('This request requires client support for asynchronous service operations.');
            });
        });

        it('returns 422 Unprocessable Entity when accepts_incomplete not true', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=false`)
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              parameters: parameters,
              accepts_incomplete: accepts_incomplete
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(422);
              expect(res.body.error).to.be.eql('AsyncRequired');
              expect(res.body.description).to.be.eql('This request requires client support for asynchronous service operations.');
            });
        });

        it('returns 400 BadRequest when space_guid missing', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              organization_guid: organization_guid,
              parameters: parameters,
              accepts_incomplete: accepts_incomplete
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(400);
              expect(res.body.error).to.be.eql('Bad Request');
              expect(res.body.description).to.be.eql('This request is missing mandatory organization guid and/or space guid.');
            });
        });

        it('returns 400 BadRequest when organization_guid missing', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              space_guid: space_guid,
              parameters: parameters,
              accepts_incomplete: accepts_incomplete
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(400);
              expect(res.body.error).to.be.eql('Bad Request');
              expect(res.body.description).to.be.eql('This request is missing mandatory organization guid and/or space guid.');
            });
        });

        it('returns 400 BadRequest when both organization_guid and space_guid missing', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'cloudfoundry',
                organization_guid: organization_guid,
                space_guid: space_guid
              },
              parameters: parameters,
              accepts_incomplete: accepts_incomplete
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(400);
              expect(res.body.error).to.be.eql('Bad Request');
              expect(res.body.description).to.be.eql('This request is missing mandatory organization guid and/or space guid.');
            });
        });

        it('returns 400 BadRequest when both organization_guid and space_guid missing: for K8S', function () {
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}?accepts_incomplete=true`)
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              context: {
                platform: 'kubernetes',
                namespace: 'default'
              },
              parameters: parameters,
              accepts_incomplete: accepts_incomplete
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(400);
              expect(res.body.error).to.be.eql('Bad Request');
              expect(res.body.description).to.be.eql('This request is missing mandatory organization guid and/or space guid.');
            });
        });

      });

      describe('#deprovision', function () {
        it('returns 202 Accepted', function () {
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_DELETE;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          const restoreFilename = `${space_guid}/restore/${service_id}.${instance_id}.json`;
          const restorePathname = `/${container}/${restoreFilename}`;
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', {
            platform: 'cloudfoundry',
            organization_guid: organization_guid,
            space_guid: space_guid
          });
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.agent.getInfo();
          mocks.agent.deprovision();
          mocks.director.verifyDeploymentLockStatus();
          if (_.get(config, 'feature.EnableSecurityGroupsOps', true)) {
            mocks.cloudController.findSecurityGroupByName(instance_id);
          }
          mocks.cloudController.getServiceInstance(instance_id, {
            space_guid: space_guid
          });
          if (_.get(config, 'feature.EnableSecurityGroupsOps', true)) {
            mocks.cloudController.deleteSecurityGroup(instance_id);
          }
          mocks.director.deleteDeployment(task_id);
          mocks.cloudProvider.remove(restorePathname);
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id,
              accepts_incomplete: accepts_incomplete
            })
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(202);
              expect(res.body).to.have.property('operation');
              expect(utils.decodeBase64(res.body.operation)).to.eql({
                task_id: `${deployment_name}_${task_id}`,
                type: 'delete',
                context: {
                  platform: 'cloudfoundry'
                }
              });
              mocks.verify();
            });
        });
        it('returns 202 Accepted : existing deployments having no platform-context', function () {
          const restoreFilename = `${space_guid}/restore/${service_id}.${instance_id}.json`;
          const restorePathname = `/${container}/${restoreFilename}`;
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_DELETE;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentProperty(deployment_name, false, 'platform-context', {
            platform: 'cloudfoundry',
            organization_guid: organization_guid,
            space_guid: space_guid
          });
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.agent.getInfo();
          mocks.agent.deprovision();
          mocks.director.verifyDeploymentLockStatus();
          if (_.get(config, 'feature.EnableSecurityGroupsOps', true)) {
            mocks.cloudController.findSecurityGroupByName(instance_id);
          }
          mocks.cloudController.getServiceInstance(instance_id, {
            space_guid: space_guid
          });
          if (_.get(config, 'feature.EnableSecurityGroupsOps', true)) {
            mocks.cloudController.deleteSecurityGroup(instance_id);
          }
          mocks.director.deleteDeployment(task_id);
          mocks.cloudProvider.remove(restorePathname);
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id,
              accepts_incomplete: accepts_incomplete
            })
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(202);
              expect(res.body).to.have.property('operation');
              expect(utils.decodeBase64(res.body.operation)).to.eql({
                task_id: `${deployment_name}_${task_id}`,
                type: 'delete',
                context: {
                  platform: 'cloudfoundry'
                }
              });
              mocks.verify();
            });
        });
        it('returns 202 Accepted : In K8S Platform', function () {
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_DELETE;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', {
            platform: 'kubernetes',
            namespace: 'default'
          });
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.director.verifyDeploymentLockStatus();

          mocks.director.deleteDeployment(task_id);
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id,
              accepts_incomplete: accepts_incomplete
            })
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(202);
              expect(res.body).to.have.property('operation');
              expect(utils.decodeBase64(res.body.operation)).to.eql({
                task_id: `${deployment_name}_${task_id}`,
                type: 'delete',
                context: {
                  platform: 'kubernetes'
                }
              });
              mocks.verify();
            });
        });

        it('returns 422 Unprocessable Entity when accepts_incomplete is not in query', function () {
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', {
            platform: 'cloudfoundry',
            organization_guid: organization_guid,
            space_guid: space_guid
          });
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id
            })
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(422);
              expect(res.body.error).to.be.eql('AsyncRequired');
              expect(res.body.description).to.be.eql('This request requires client support for asynchronous service operations.');
            });
        });

        it('returns 422 Unprocessable Entity when accepts_incomplete is undefined', function () {
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', {
            platform: 'cloudfoundry',
            organization_guid: organization_guid,
            space_guid: space_guid
          });
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id,
              accepts_incomplete: undefined
            })
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(422);
              expect(res.body.error).to.be.eql('AsyncRequired');
              expect(res.body.description).to.be.eql('This request requires client support for asynchronous service operations.');
            });
        });

        it('returns 422 Unprocessable Entity when accepts_incomplete is not true', function () {
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', {
            platform: 'cloudfoundry',
            organization_guid: organization_guid,
            space_guid: space_guid
          });
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id,
              accepts_incomplete: false
            })
            .set('X-Broker-API-Version', api_version)
            .set('Accept', 'application/json')
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(422);
              expect(res.body.error).to.be.eql('AsyncRequired');
              expect(res.body.description).to.be.eql('This request requires client support for asynchronous service operations.');
            });
        });

      });

      describe('#bind', function () {
        it('no context : returns 201 Created', function (done) {
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .set('id', binding_id)
            .set('parameters', {})
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_BIND;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', {
            platform: 'cloudfoundry'
          });
          config.mongodb.provision.plan_id = 'bc158c9a-7934-401e-94ab-057082a5073f';
          deferred.reject(new errors.NotFound('Schedule not found'));
          const WAIT_TIME_FOR_ASYNCH_SCHEDULE_OPERATION = 0;
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.agent.getInfo();
          mocks.agent.createCredentials();
          mocks.director.createBindingProperty(binding_id);
          mocks.serviceFabrikClient.scheduleBackup(instance_id, {
            type: CONST.BACKUP.TYPE.ONLINE,
            repeatInterval: 'daily'
          });
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}/service_bindings/${binding_id}`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              app_guid: app_guid,
              bind_resource: {
                app_guid: app_guid
              }
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(201);
              expect(res.body).to.eql({
                credentials: mocks.agent.credentials
              });
              setTimeout(() => {
                delete config.mongodb.provision.plan_id;
                expect(getScheduleStub).to.be.calledOnce;
                expect(getScheduleStub.firstCall.args[0]).to.eql(instance_id);
                expect(getScheduleStub.firstCall.args[1]).to.eql(CONST.JOB.SCHEDULED_BACKUP);
                mocks.verify();
                done();
                //Schedule operation is performed in background after response has been returned,
                //hence added this delay of 500 ms which should work in all cases.
                //In case asserts are failing, try increasing the timeout first & then debug. :-)
              }, WAIT_TIME_FOR_ASYNCH_SCHEDULE_OPERATION);
            });
        });
        it('returns 201 Created', function (done) {
          config.mongodb.provision.plan_id = 'bc158c9a-7934-401e-94ab-057082a5073f';
          deferred.reject(new errors.NotFound('Schedule not found'));
          const WAIT_TIME_FOR_ASYNCH_SCHEDULE_OPERATION = 0;
          const context = {
            platform: 'cloudfoundry',
            organization_guid: organization_guid,
            space_guid: space_guid
          };
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .set('id', binding_id)
            .set('parameters', {})
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_BIND;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.agent.getInfo();
          mocks.agent.createCredentials();
          mocks.director.createBindingProperty(binding_id);
          mocks.serviceFabrikClient.scheduleBackup(instance_id, {
            type: CONST.BACKUP.TYPE.ONLINE,
            repeatInterval: 'daily'
          });
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}/service_bindings/${binding_id}`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              app_guid: app_guid,
              bind_resource: {
                app_guid: app_guid
              },
              context: context
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(201);
              expect(res.body).to.eql({
                credentials: mocks.agent.credentials
              });
              setTimeout(() => {
                delete config.mongodb.provision.plan_id;
                expect(getScheduleStub).to.be.calledOnce;
                expect(getScheduleStub.firstCall.args[0]).to.eql(instance_id);
                expect(getScheduleStub.firstCall.args[1]).to.eql(CONST.JOB.SCHEDULED_BACKUP);
                mocks.verify();
                done();
                //Schedule operation is performed in background after response has been returned,
                //hence added this delay of 500 ms which should work in all cases.
                //In case asserts are failing, try increasing the timeout first & then debug. :-)
              }, WAIT_TIME_FOR_ASYNCH_SCHEDULE_OPERATION);
            });
        });
        it('returns 201 Created: In K8S platform', function (done) {
          config.mongodb.provision.plan_id = 'bc158c9a-7934-401e-94ab-057082a5073f';
          deferred.reject(new errors.NotFound('Schedule not found'));
          const WAIT_TIME_FOR_ASYNCH_SCHEDULE_OPERATION = 0;
          const context = {
            platform: 'kubernetes',
            namespace: 'default'
          };
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .set('id', binding_id)
            .set('parameters', {})
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_BIND;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.agent.getInfo();
          mocks.agent.createCredentials();
          mocks.director.createBindingProperty(binding_id);
          mocks.serviceFabrikClient.scheduleBackup(instance_id, {
            type: CONST.BACKUP.TYPE.ONLINE,
            repeatInterval: 'daily'
          });
          return chai.request(app)
            .put(`${base_url}/service_instances/${instance_id}/service_bindings/${binding_id}`)
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .send({
              service_id: service_id,
              plan_id: plan_id,
              app_guid: app_guid,
              bind_resource: {
                app_guid: app_guid
              },
              context: context
            })
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(201);
              expect(res.body).to.eql({
                credentials: mocks.agent.credentials
              });
              setTimeout(() => {
                delete config.mongodb.provision.plan_id;
                expect(getScheduleStub).to.be.calledOnce;
                expect(getScheduleStub.firstCall.args[0]).to.eql(instance_id);
                expect(getScheduleStub.firstCall.args[1]).to.eql(CONST.JOB.SCHEDULED_BACKUP);
                mocks.verify();
                done();
                //Schedule operation is performed in background after response has been returned,
                //hence added this delay of 500 ms which should work in all cases.
                //In case asserts are failing, try increasing the timeout first & then debug. :-)
              }, WAIT_TIME_FOR_ASYNCH_SCHEDULE_OPERATION);
            });
        });

      });

      describe('#unbind', function () {
        it('returns 200 OK', function () {
          const context = {
            platform: 'cloudfoundry',
            organization_guid: organization_guid,
            space_guid: space_guid
          };
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .set('id', binding_id)
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_UNBIND;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', context);
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.director.getBindingProperty(binding_id);
          mocks.agent.getInfo();
          mocks.agent.deleteCredentials();
          mocks.director.deleteBindingProperty(binding_id);
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}/service_bindings/${binding_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id
            })
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(200);
              expect(res.body).to.eql({});
              mocks.verify();
            });
        });
        it('returns 200 OK : for existing deployment having no platform-context', function () {
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .set('id', binding_id)
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_UNBIND;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentProperty(deployment_name, false, 'platform-context', undefined);
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.director.getBindingProperty(binding_id);
          mocks.agent.getInfo();
          mocks.agent.deleteCredentials();
          mocks.director.deleteBindingProperty(binding_id);
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}/service_bindings/${binding_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id
            })
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(200);
              expect(res.body).to.eql({});
              mocks.verify();
            });
        });
        it('returns 200 OK: In K8S platform', function () {
          const context = {
            platform: 'kubernetes',
            namespace: 'default'
          };
          const expectedRequestBody = _.cloneDeep(deploymentHookRequestBody);
          expectedRequestBody.context = _.chain(expectedRequestBody.context)
            .set('id', binding_id)
            .omit('params')
            .omit('sf_operations_args')
            .value();
          expectedRequestBody.phase = CONST.SERVICE_LIFE_CYCLE.PRE_UNBIND;
          mocks.deploymentHookClient.executeDeploymentActions(200, expectedRequestBody);
          mocks.director.getDeploymentProperty(deployment_name, true, 'platform-context', context);
          mocks.director.getDeploymentInstances(deployment_name);
          mocks.director.getBindingProperty(binding_id);
          mocks.agent.getInfo();
          mocks.agent.deleteCredentials();
          mocks.director.deleteBindingProperty(binding_id);
          return chai.request(app)
            .delete(`${base_url}/service_instances/${instance_id}/service_bindings/${binding_id}`)
            .query({
              service_id: service_id,
              plan_id: plan_id
            })
            .set('X-Broker-API-Version', api_version)
            .auth(config.username, config.password)
            .catch(err => err.response)
            .then(res => {
              expect(res).to.have.status(200);
              expect(res.body).to.eql({});
              mocks.verify();
            });
        });
      });

      describe('#getInfo', function () {

        let sandbox, getDeploymentInfoStub, getServiceInstanceStub, getServicePlanStub;

        before(function () {
          sandbox = sinon.sandbox.create();
          getDeploymentInfoStub = sandbox.stub(DirectorManager.prototype, 'getDeploymentInfo');
          getServiceInstanceStub = sandbox.stub(cloudController, 'getServiceInstance');
          getServicePlanStub = sandbox.stub(cloudController, 'getServicePlan');

          let entity = {};
          getServiceInstanceStub
            .withArgs(instance_id)
            .returns(Promise.try(() => {
              return {
                metadata: {
                  guid: instance_id
                },
                entity: _.assign({
                  name: 'blueprint',
                  service_plan_guid: '466c5078-df6e-427d-8fb2-c76af50c0f56'
                }, entity)
              };
            }));

          getDeploymentInfoStub
            .withArgs(deployment_name)
            .returns(Promise.try(() => {
              return {};
            }));

          entity = {};
          getServicePlanStub
            .withArgs(service_plan_guid, {})
            .returns(Promise.try(() => {
              return {
                entity: _.assign({
                  unique_id: plan_id,
                  name: 'blueprint'
                }, entity)
              };
            }));

        });

        after(function () {
          sandbox.restore();
        });

        it('should return object with correct plan and service information', function () {
          let context = {
            platform: 'cloudfoundry'
          };
          return fabrik
            .createInstance(instance_id, service_id, plan_id, context)
            .then(instance => instance.getInfo())
            .catch(err => err.response)
            .then(res => {
              expect(res.title).to.equal('Blueprint Dashboard');
              expect(res.plan.id).to.equal(plan_id);
              expect(res.service.id).to.equal(service_id);
              expect(res.instance.metadata.guid).to.equal(instance_id);
            });
        });
      });
    });
  });
});